from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(min_length=1)
    projectIds: list[str] = Field(min_length=1)


class Citation(BaseModel):
    projectId: str
    projectName: str
    documentId: str
    documentName: str
    pages: str


class SelectedDocument(BaseModel):
    documentId: str


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    selectedDocuments: list[SelectedDocument]
