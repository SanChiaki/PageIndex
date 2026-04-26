from __future__ import annotations

from ast import literal_eval
from collections import Counter
import re
from typing import Any


_CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")
_LATIN_RE = re.compile(r"[a-z0-9]+")


def _tokenize_query(text: str) -> list[str]:
    lowered = text.lower()
    latin_tokens = _LATIN_RE.findall(lowered)
    cjk_chars = _CJK_RE.findall(text)
    cjk_tokens = list(cjk_chars)
    if len(cjk_chars) > 1:
        cjk_tokens.extend(
            "".join(cjk_chars[index : index + 2]) for index in range(len(cjk_chars) - 1)
        )
    return [token for token in [*latin_tokens, *cjk_tokens] if token]


def keyword_score(query: str, doc: dict) -> int:
    tokens = _tokenize_query(query)
    haystack = " ".join(
        [
            doc.get("project_name", ""),
            doc.get("file_name", ""),
            doc.get("project_relative_path", ""),
            doc.get("source_relative_path", ""),
            doc.get("doc_description", ""),
        ]
    ).lower()
    counts = Counter(tokens)
    return sum(weight for token, weight in counts.items() if token in haystack)


def _keyword_select_documents(query: str, docs: list[dict], limit: int) -> list[dict]:
    scored = [
        (keyword_score(query, doc), doc.get("file_name", ""), doc)
        for doc in docs
    ]
    ranked = sorted(scored, key=lambda item: (item[0], item[1]), reverse=True)
    return [doc for score, _file_name, doc in ranked if score > 0][:limit]


def _selection_prompt(query: str, docs: list[dict]) -> str:
    candidates = [
        {
            "doc_id": doc.get("id", ""),
            "project_name": doc.get("project_name", ""),
            "doc_name": doc.get("file_name", ""),
            "project_relative_path": doc.get("project_relative_path", ""),
            "source_relative_path": doc.get("source_relative_path", ""),
            "doc_description": doc.get("doc_description", ""),
        }
        for doc in docs
    ]
    return f"""
You are selecting candidate documents before PageIndex tree retrieval.

Choose the document IDs that are most likely to contain information needed to answer the query.
Use the project name, relative paths, file name, and one-sentence document description.
The query and the document descriptions may be written in different languages.
Prefer recall over precision: include a document if it may plausibly help answer the query.

Query:
{query}

Candidate Documents:
{candidates}

Return valid JSON only:
{{"thinking":"brief reason","answer":["doc_id_1","doc_id_2"]}}
"""


def _strip_code_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _extract_selected_doc_ids(raw: str) -> list[str] | None:
    from pageindex.utils import extract_json

    parsed: Any = extract_json(raw)
    if not parsed:
        try:
            parsed = literal_eval(_strip_code_fence(raw))
        except (SyntaxError, ValueError):
            return None

    answer: Any = parsed
    if isinstance(parsed, dict):
        if "answer" in parsed:
            answer = parsed["answer"]
        elif "doc_ids" in parsed:
            answer = parsed["doc_ids"]
        else:
            return None

    if isinstance(answer, str):
        try:
            answer = literal_eval(answer)
        except (SyntaxError, ValueError):
            return None

    if not isinstance(answer, list):
        return None

    selected_doc_ids: list[str] = []
    for item in answer:
        if not isinstance(item, str):
            continue
        doc_id = item.strip()
        if doc_id:
            selected_doc_ids.append(doc_id)
    return selected_doc_ids


def _llm_select_documents(
    query: str,
    docs: list[dict],
    *,
    limit: int,
    model: str | None,
) -> list[dict] | None:
    from pageindex.utils import llm_completion

    prompt = _selection_prompt(query, docs)
    try:
        raw = llm_completion(model=model, prompt=prompt)
    except Exception:
        return None

    selected_doc_ids = _extract_selected_doc_ids(raw)
    if selected_doc_ids is None:
        return None

    docs_by_id = {doc.get("id", ""): doc for doc in docs if doc.get("id")}
    selected_docs: list[dict] = []
    seen_doc_ids: set[str] = set()
    for doc_id in selected_doc_ids:
        if doc_id in seen_doc_ids:
            continue
        document = docs_by_id.get(doc_id)
        if not document:
            continue
        selected_docs.append(document)
        seen_doc_ids.add(doc_id)
        if len(selected_docs) >= limit:
            break
    return selected_docs


def select_candidate_documents(
    query: str,
    docs: list[dict],
    limit: int = 8,
    model: str | None = None,
) -> list[dict]:
    if limit <= 0 or not docs:
        return []

    llm_selected = _llm_select_documents(query, docs, limit=limit, model=model)
    if llm_selected is not None:
        return llm_selected

    return _keyword_select_documents(query, docs, limit)
