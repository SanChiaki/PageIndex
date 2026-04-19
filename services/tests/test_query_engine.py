import json
import sqlite3
from pathlib import Path
from types import SimpleNamespace

from services.retrieval_api import query_engine
from services.retrieval_api.query_engine import answer_question, build_citation


def test_build_citation_includes_project_and_pages():
    citation = build_citation(
        project={"id": "proj_1", "name": "Alpha"},
        document={"id": "doc_1", "file_name": "alpha.pdf"},
        pages="4-5",
    )

    assert citation == {
        "projectId": "proj_1",
        "projectName": "Alpha",
        "documentId": "doc_1",
        "documentName": "alpha.pdf",
        "pages": "4-5",
    }


def _schema_sql() -> str:
    repo_root = Path(__file__).resolve().parents[2]
    schema_path = repo_root / "web" / "lib" / "db" / "schema.sql"
    return schema_path.read_text(encoding="utf-8")


def _seed_retrieval_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "app.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(_schema_sql())
    conn.execute(
        "INSERT INTO projects (id, owner_user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        ("proj_1", "user_demo", "Alpha", "2026-04-19T00:00:00Z", "2026-04-19T00:00:00Z"),
    )
    conn.commit()
    conn.close()
    return db_path


def _insert_ready_document(
    db_path: Path,
    document_id: str,
    file_name: str,
    doc_description: str,
    structure_json: str,
    pages_json: str,
):
    conn = sqlite3.connect(db_path)
    conn.execute(
        """INSERT INTO documents
           (id, project_id, owner_user_id, file_name, storage_path, mime_type, file_size, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            document_id,
            "proj_1",
            "user_demo",
            file_name,
            f"/tmp/{file_name}",
            "application/pdf",
            128,
            "ready",
            "2026-04-19T00:00:00Z",
            "2026-04-19T00:00:00Z",
        ),
    )
    conn.execute(
        """
        INSERT INTO document_indexes (
          id, document_id, doc_name, doc_description, structure_json,
          pages_json, index_version, indexed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            f"idx_{document_id}",
            document_id,
            file_name,
            doc_description,
            structure_json,
            pages_json,
            "v1",
            "2026-04-19T00:00:00Z",
        ),
    )
    conn.commit()
    conn.close()


def test_answer_question_falls_back_when_llm_pages_are_invalid(tmp_path, monkeypatch):
    db_path = _seed_retrieval_db(tmp_path)
    _insert_ready_document(
        db_path,
        document_id="doc_1",
        file_name="alpha.pdf",
        doc_description="cash flow risk discussion",
        structure_json=json.dumps([{"title": "s1"}]),
        pages_json=json.dumps(
            [
                {"page": 1, "content": "cash flow details"},
                {"page": 2, "content": "risk details"},
            ]
        ),
    )

    monkeypatch.setattr(
        "services.retrieval_api.query_engine.choose_page_window",
        lambda _query, _doc: "999-1000",
    )

    def fake_load_page_excerpt(_document, pages):
        if pages == "1-2":
            return [{"page": 1, "content": "fallback evidence"}]
        return []

    monkeypatch.setattr(
        "services.retrieval_api.query_engine._load_page_excerpt",
        fake_load_page_excerpt,
    )
    captured_context: dict = {}

    def fake_generate_answer(_query, context_blocks):
        captured_context["blocks"] = context_blocks
        return "answer from fallback"

    monkeypatch.setattr(
        "services.retrieval_api.query_engine._generate_answer",
        fake_generate_answer,
    )

    result = answer_question(str(db_path), "cash flow risk", ["proj_1"])

    assert result["answer"] == "answer from fallback"
    assert result["citations"][0]["pages"] == "1-2"
    assert captured_context["blocks"][0]["evidence"] == [
        {"page": 1, "content": "fallback evidence"}
    ]


def test_answer_question_skips_bad_index_rows_and_uses_good_documents(tmp_path, monkeypatch):
    db_path = _seed_retrieval_db(tmp_path)
    _insert_ready_document(
        db_path,
        document_id="doc_good",
        file_name="good.pdf",
        doc_description="cash flow summary",
        structure_json=json.dumps([{"title": "good"}]),
        pages_json=json.dumps([{"page": 1, "content": "good evidence"}]),
    )
    _insert_ready_document(
        db_path,
        document_id="doc_bad",
        file_name="bad.pdf",
        doc_description="cash flow summary",
        structure_json="not-json",
        pages_json=json.dumps([{"page": 1, "content": "bad evidence"}]),
    )

    monkeypatch.setattr(
        "services.retrieval_api.query_engine.choose_page_window",
        lambda _query, _doc: "1",
    )
    monkeypatch.setattr(
        "services.retrieval_api.query_engine._load_page_excerpt",
        lambda _document, _pages: [{"page": 1, "content": "good evidence"}],
    )
    monkeypatch.setattr(
        "services.retrieval_api.query_engine._generate_answer",
        lambda _query, _blocks: "final answer",
    )

    result = answer_question(str(db_path), "cash flow", ["proj_1"])

    assert result["answer"] == "final answer"
    assert result["selectedDocuments"] == [{"documentId": "doc_good"}]
    assert result["citations"] == [
        {
            "projectId": "proj_1",
            "projectName": "Alpha",
            "documentId": "doc_good",
            "documentName": "good.pdf",
            "pages": "1",
        }
    ]


def test_answer_question_falls_back_when_llm_pages_range_is_oversized(
    tmp_path, monkeypatch
):
    db_path = _seed_retrieval_db(tmp_path)
    _insert_ready_document(
        db_path,
        document_id="doc_large",
        file_name="large.pdf",
        doc_description="cash flow deep dive",
        structure_json=json.dumps([{"title": "large"}]),
        pages_json=json.dumps(
            [
                {"page": page, "content": f"content-{page}"}
                for page in range(1, 1002)
            ]
        ),
    )

    monkeypatch.setattr(
        "services.retrieval_api.query_engine.choose_page_window",
        lambda _query, _doc: "1-1001",
    )
    monkeypatch.setattr(
        "services.retrieval_api.query_engine._load_page_excerpt",
        lambda _document, pages: [{"page": 1, "content": f"evidence:{pages}"}],
    )
    monkeypatch.setattr(
        "services.retrieval_api.query_engine._generate_answer",
        lambda _query, _blocks: "answer with fallback",
    )

    result = answer_question(str(db_path), "cash flow", ["proj_1"])

    assert result["answer"] == "answer with fallback"
    assert result["citations"][0]["pages"] == "1-2"


def test_retrieval_llm_uses_configured_model(monkeypatch):
    query_engine._get_retrieval_model.cache_clear()
    monkeypatch.setattr(
        "pageindex.utils.ConfigLoader.load",
        lambda self, user_opt=None: SimpleNamespace(
            model="gpt-base",
            retrieve_model="gpt-retrieval",
        ),
    )
    monkeypatch.setattr(
        "pageindex.retrieve.get_document_structure",
        lambda _document_map, _document_id: '{"nodes":[]}',
    )

    seen_models: list[str | None] = []

    def fake_llm_completion(model, prompt, chat_history=None, return_finish_reason=False):
        seen_models.append(model)
        if "Return JSON only" in prompt:
            return '{"pages": "2"}'
        return "final answer"

    monkeypatch.setattr("pageindex.utils.llm_completion", fake_llm_completion)

    document = {
        "id": "doc_1",
        "file_name": "alpha.pdf",
        "doc_description": "Alpha",
        "structure": [{"title": "Intro"}],
        "pages": [
            {"page": 1, "content": "intro"},
            {"page": 2, "content": "details"},
        ],
    }

    pages = query_engine.choose_page_window("what is on page 2", document)
    answer = query_engine._generate_answer(
        "what is on page 2",
        [{"document": "alpha.pdf", "pages": "2", "evidence": [{"page": 2, "content": "details"}]}],
    )

    assert pages == "2"
    assert answer == "final answer"
    assert seen_models == ["gpt-retrieval", "gpt-retrieval"]


def test_answer_question_uses_description_selection_for_cross_language_query(
    tmp_path, monkeypatch
):
    query_engine._get_retrieval_model.cache_clear()
    db_path = _seed_retrieval_db(tmp_path)
    _insert_ready_document(
        db_path,
        document_id="doc_acceptance",
        file_name="acceptance.pdf",
        doc_description="Acceptance criteria, delivery checklist, and sign-off standards.",
        structure_json=json.dumps([{"title": "Acceptance"}]),
        pages_json=json.dumps([{"page": 1, "content": "All deliverables must pass review."}]),
    )
    _insert_ready_document(
        db_path,
        document_id="doc_schedule",
        file_name="schedule.pdf",
        doc_description="Timeline, milestones, and staffing plan.",
        structure_json=json.dumps([{"title": "Timeline"}]),
        pages_json=json.dumps([{"page": 1, "content": "Project starts in May."}]),
    )

    monkeypatch.setattr(
        "pageindex.utils.ConfigLoader.load",
        lambda self, user_opt=None: SimpleNamespace(
            model="gpt-base",
            retrieve_model="gpt-retrieval",
        ),
    )

    seen_models: list[str | None] = []

    def fake_llm_completion(model, prompt, chat_history=None, return_finish_reason=False):
        seen_models.append(model)
        assert "这个项目的验收标准是什么？" in prompt
        return '{"thinking":"doc_acceptance is the acceptance criteria document","answer":["doc_acceptance"]}'

    monkeypatch.setattr("pageindex.utils.llm_completion", fake_llm_completion)
    monkeypatch.setattr(
        "services.retrieval_api.query_engine.choose_page_window",
        lambda _query, _doc: "1",
    )
    monkeypatch.setattr(
        "services.retrieval_api.query_engine._load_page_excerpt",
        lambda _document, _pages: [{"page": 1, "content": "All deliverables must pass review."}],
    )
    monkeypatch.setattr(
        "services.retrieval_api.query_engine._generate_answer",
        lambda _query, _blocks: "验收标准包括交付物评审和签收。",
    )

    result = answer_question(str(db_path), "这个项目的验收标准是什么？", ["proj_1"])

    assert result["answer"] == "验收标准包括交付物评审和签收。"
    assert result["selectedDocuments"] == [{"documentId": "doc_acceptance"}]
    assert result["citations"] == [
        {
            "projectId": "proj_1",
            "projectName": "Alpha",
            "documentId": "doc_acceptance",
            "documentName": "acceptance.pdf",
            "pages": "1",
        }
    ]
    assert seen_models == ["gpt-retrieval"]
