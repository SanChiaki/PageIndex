from services.retrieval_api.select_documents import (
    keyword_score,
    select_candidate_documents,
)


def test_keyword_score_prefers_matching_description():
    query = "cash flow risk"
    doc = {
        "id": "doc_1",
        "project_id": "proj_1",
        "file_name": "alpha.pdf",
        "doc_description": "Cash flow risk factors and debt covenants",
    }

    assert keyword_score(query, doc) > 0


def test_keyword_score_matches_project_relative_path():
    doc = {
        "id": "doc_1",
        "project_id": "proj_1",
        "file_name": "report.pdf",
        "project_name": "Alpha",
        "project_relative_path": "delivery/acceptance/report.pdf",
        "source_relative_path": "Alpha/delivery/acceptance/report.pdf",
        "doc_description": "Network delivery evidence.",
    }

    assert keyword_score("acceptance handover", doc) > 0


def test_select_candidate_documents_limits_results():
    docs = [
        {
            "id": f"doc_{index}",
            "project_id": "proj_1",
            "file_name": f"doc-{index}.pdf",
            "doc_description": "cash flow risk" if index < 3 else "unrelated",
        }
        for index in range(10)
    ]

    selected = select_candidate_documents("cash flow risk", docs, limit=2)
    assert len(selected) == 2


def test_select_candidate_documents_uses_llm_description_selection(monkeypatch):
    docs = [
        {
            "id": "doc_scope",
            "project_id": "proj_1",
            "project_name": "Alpha",
            "file_name": "project-scope.pdf",
            "project_relative_path": "planning/project-scope.pdf",
            "source_relative_path": "Alpha/planning/project-scope.pdf",
            "doc_description": "Project scope, milestones, and staffing plan.",
        },
        {
            "id": "doc_acceptance",
            "project_id": "proj_1",
            "project_name": "Alpha",
            "file_name": "acceptance-criteria.pdf",
            "project_relative_path": "delivery/acceptance-criteria.pdf",
            "source_relative_path": "Alpha/delivery/acceptance-criteria.pdf",
            "doc_description": "Acceptance criteria, completion checklist, and review standards.",
        },
    ]

    def fake_llm_completion(model, prompt, chat_history=None, return_finish_reason=False):
        assert model == "gpt-retrieval"
        assert "这个项目的验收标准是什么？" in prompt
        assert "acceptance-criteria.pdf" in prompt
        assert "delivery/acceptance-criteria.pdf" in prompt
        assert "Alpha/delivery/acceptance-criteria.pdf" in prompt
        return '{"thinking":"doc_acceptance matches acceptance criteria","answer":["doc_acceptance"]}'

    monkeypatch.setattr("pageindex.utils.llm_completion", fake_llm_completion)

    selected = select_candidate_documents(
        "这个项目的验收标准是什么？",
        docs,
        limit=2,
        model="gpt-retrieval",
    )

    assert [doc["id"] for doc in selected] == ["doc_acceptance"]


def test_select_candidate_documents_falls_back_to_keywords_when_llm_response_is_invalid(
    monkeypatch,
):
    docs = [
        {
            "id": "doc_1",
            "project_id": "proj_1",
            "file_name": "cash-flow.pdf",
            "doc_description": "Cash flow risk factors and debt covenants",
        },
        {
            "id": "doc_2",
            "project_id": "proj_1",
            "file_name": "staffing.pdf",
            "doc_description": "Team roster and roles",
        },
    ]

    monkeypatch.setattr(
        "pageindex.utils.llm_completion",
        lambda model, prompt, chat_history=None, return_finish_reason=False: "not-json",
    )

    selected = select_candidate_documents(
        "cash flow risk",
        docs,
        limit=2,
        model="gpt-retrieval",
    )

    assert [doc["id"] for doc in selected] == ["doc_1"]
