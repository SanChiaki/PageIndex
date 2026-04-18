import json
from typing import Any

from services.common.sqlite_store import open_db
from services.retrieval_api.select_documents import select_candidate_documents

MAX_PAGE_RANGE_SIZE = 1000
MAX_PAGE_SELECTION_SIZE = 1000


def build_citation(project: dict[str, str], document: dict[str, str], pages: str) -> dict:
    return {
        "projectId": project["id"],
        "projectName": project["name"],
        "documentId": document["id"],
        "documentName": document["file_name"],
        "pages": pages,
    }


def _default_page_window(document: dict[str, Any]) -> str:
    page_numbers = sorted(
        {
            int(page["page"])
            for page in document.get("pages", [])
            if isinstance(page, dict) and isinstance(page.get("page"), int)
        }
    )
    if not page_numbers:
        return "1"
    if len(page_numbers) == 1:
        return str(page_numbers[0])
    return f"{page_numbers[0]}-{page_numbers[1]}"


def _available_page_numbers(document: dict[str, Any]) -> list[int]:
    page_numbers = sorted(
        {
            int(page["page"])
            for page in document.get("pages", [])
            if isinstance(page, dict) and isinstance(page.get("page"), int)
        }
    )
    return page_numbers


def _parse_page_window(pages: str) -> list[int] | None:
    if not isinstance(pages, str):
        return None
    text = pages.strip()
    if not text:
        return None

    selected_pages: set[int] = set()
    for token in text.split(","):
        part = token.strip()
        if not part:
            return None
        if "-" in part:
            left, right = part.split("-", 1)
            if not left.strip().isdigit() or not right.strip().isdigit():
                return None
            start = int(left.strip())
            end = int(right.strip())
            if start <= 0 or end < start:
                return None
            span = end - start + 1
            if span > MAX_PAGE_RANGE_SIZE:
                return None
            if len(selected_pages) + span > MAX_PAGE_SELECTION_SIZE:
                return None
            for page in range(start, end + 1):
                selected_pages.add(page)
            continue
        if not part.isdigit():
            return None
        page = int(part)
        if page <= 0:
            return None
        selected_pages.add(page)
        if len(selected_pages) > MAX_PAGE_SELECTION_SIZE:
            return None

    if not selected_pages:
        return None
    return sorted(selected_pages)


def _is_valid_page_window(pages: str, document: dict[str, Any]) -> bool:
    selected = _parse_page_window(pages)
    if not selected:
        return False
    available = set(_available_page_numbers(document))
    if not available:
        return False
    return all(page in available for page in selected)


def _build_document_map(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        document["id"]: {
            "type": "pdf",
            "page_count": len(document.get("pages", [])),
            "doc_name": document.get("file_name", ""),
            "doc_description": document.get("doc_description", ""),
            "structure": document.get("structure", []),
            "pages": document.get("pages", []),
        }
    }


def choose_page_window(query: str, document: dict[str, Any]) -> str:
    from pageindex.retrieve import get_document_structure
    from pageindex.utils import extract_json, llm_completion

    document_map = _build_document_map(document)
    fallback = _default_page_window(document)
    structure_json = get_document_structure(document_map, document["id"])
    prompt = f"""
You are selecting the smallest useful page range for a PDF question.

Question: {query}
Structure:
{structure_json}

Return JSON only:
{{"pages": "3-5"}}
"""
    try:
        parsed = extract_json(llm_completion(model=None, prompt=prompt))
    except Exception:
        return fallback

    pages = parsed.get("pages") if isinstance(parsed, dict) else None
    if isinstance(pages, str) and pages.strip():
        pages = pages.strip()
        if _is_valid_page_window(pages, document):
            return pages
    return fallback


def _load_page_excerpt(document: dict[str, Any], pages: str) -> list[dict[str, Any]]:
    from pageindex.retrieve import get_page_content

    document_map = _build_document_map(document)
    raw = get_page_content(document_map, document["id"], pages)
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []

    return parsed if isinstance(parsed, list) else []


def _generate_answer(query: str, context_blocks: list[dict[str, Any]]) -> str:
    from pageindex.utils import llm_completion

    prompt = f"""
Answer the user's question only from the provided document evidence.

Question: {query}

Evidence:
{json.dumps(context_blocks, ensure_ascii=False)}

Return only the answer text.
"""
    try:
        answer = llm_completion(model=None, prompt=prompt).strip()
    except Exception:
        answer = ""
    return answer or "I could not generate an answer from the selected documents."


def answer_question(db_path: str, query: str, project_ids: list[str]) -> dict:
    if not project_ids:
        return {
            "answer": "No projects were selected for retrieval.",
            "citations": [],
            "selectedDocuments": [],
        }

    placeholders = ",".join("?" for _ in project_ids)
    with open_db(db_path) as conn:
        rows = conn.execute(
            f"""
            SELECT d.id, d.project_id, d.file_name, p.name AS project_name,
                   di.doc_description, di.structure_json, di.pages_json
              FROM documents d
              JOIN projects p ON p.id = d.project_id
              JOIN document_indexes di ON di.document_id = d.id
             WHERE d.status = 'ready'
               AND d.deleted_at IS NULL
               AND d.project_id IN ({placeholders})
            """,
            project_ids,
        ).fetchall()

    docs = []
    for row in rows:
        try:
            structure = json.loads(row["structure_json"])
            pages = json.loads(row["pages_json"])
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(structure, list) or not isinstance(pages, list):
            continue
        docs.append(
            {
                "id": row["id"],
                "project_id": row["project_id"],
                "project_name": row["project_name"],
                "file_name": row["file_name"],
                "doc_description": row["doc_description"],
                "structure": structure,
                "pages": pages,
            }
        )

    selected = select_candidate_documents(query, docs, limit=5)
    if not selected:
        return {
            "answer": "No ready documents matched the selected projects.",
            "citations": [],
            "selectedDocuments": [],
        }

    context_blocks = []
    citations = []
    used_documents = []
    for document in selected:
        pages = choose_page_window(query, document)
        fallback_pages = _default_page_window(document)
        if not _is_valid_page_window(pages, document):
            pages = fallback_pages
        evidence = _load_page_excerpt(document, pages)
        if not evidence and pages != fallback_pages:
            pages = fallback_pages
            evidence = _load_page_excerpt(document, pages)
        if not evidence:
            continue
        context_blocks.append(
            {
                "project": document["project_name"],
                "document": document["file_name"],
                "pages": pages,
                "evidence": evidence,
            }
        )
        citations.append(
            build_citation(
                project={"id": document["project_id"], "name": document["project_name"]},
                document={"id": document["id"], "file_name": document["file_name"]},
                pages=pages,
            )
        )
        used_documents.append(document)

    if not used_documents:
        return {
            "answer": "I could not find usable evidence in selected documents.",
            "citations": [],
            "selectedDocuments": [],
        }

    return {
        "answer": _generate_answer(query, context_blocks),
        "citations": citations,
        "selectedDocuments": [{"documentId": document["id"]} for document in used_documents],
    }
