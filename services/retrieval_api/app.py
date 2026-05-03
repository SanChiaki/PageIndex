from fastapi import FastAPI

from services.common.settings import DB_PATH
from services.retrieval_api.query_engine import answer_question
from services.retrieval_api.schemas import QueryRequest, QueryResponse

app = FastAPI()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/retrieve/query")
def retrieve_query(request: QueryRequest) -> QueryResponse:
    result = answer_question(str(DB_PATH), request.query, request.projectIds, mode=request.mode)
    return QueryResponse.model_validate(result)
