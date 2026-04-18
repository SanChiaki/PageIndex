from typing import TypedDict


class IndexedPage(TypedDict):
    page: int
    content: str


class IndexedDocumentPayload(TypedDict):
    doc_name: str
    doc_description: str
    structure: list[dict]
    pages: list[IndexedPage]
    page_count: int
