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
