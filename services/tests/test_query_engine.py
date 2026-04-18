from services.retrieval_api.query_engine import build_citation


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
