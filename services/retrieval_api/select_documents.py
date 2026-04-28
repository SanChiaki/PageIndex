from __future__ import annotations

from ast import literal_eval
from collections import Counter
import re
from typing import Any


_CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")
_LATIN_RE = re.compile(r"[a-z0-9]+")
DEFAULT_PREFILTER_LIMIT = 50
STRUCTURE_SEARCH_TEXT_LIMIT = 30000
MIN_STRONG_PREFILTER_SCORE = 3

_QUERY_EXPANSIONS = {
    "终验": ["final", "acceptance", "handover", "sign", "off"],
    "验收": ["acceptance", "sign", "off"],
    "交付": ["delivery", "handover", "deliverable"],
    "报告": ["report"],
    "质检": ["quality", "inspection"],
    "检查": ["check", "inspection"],
    "进展": ["progress", "status"],
    "覆盖": ["coverage"],
}
_GENERIC_TOKENS = {
    "生成",
    "报告",
    "文档",
    "项目",
    "资料",
    "内容",
    "report",
    "document",
    "project",
}


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


def _expanded_query_tokens(text: str) -> list[str]:
    tokens = _tokenize_query(text)
    lowered = text.lower()
    for trigger, expansions in _QUERY_EXPANSIONS.items():
        if trigger in text or trigger in lowered:
            tokens.extend(expansions)
    return tokens


def _structure_search_text(structure: Any, limit: int = STRUCTURE_SEARCH_TEXT_LIMIT) -> str:
    parts: list[str] = []
    total = 0
    stack = [structure]
    while stack and total < limit:
        item = stack.pop()
        if isinstance(item, list):
            stack.extend(reversed(item))
            continue
        if not isinstance(item, dict):
            continue
        for key in ("title", "summary", "prefix_summary"):
            value = item.get(key)
            if not isinstance(value, str) or not value:
                continue
            remaining = limit - total
            if remaining <= 0:
                break
            parts.append(value[:remaining])
            total += min(len(value), remaining)
        children = item.get("nodes")
        if children:
            stack.append(children)
    return " ".join(parts)


def _weighted_token_score(tokens: Counter[str], text: str, weight: int) -> int:
    if not text:
        return 0
    haystack = text.lower()
    latin_terms: set[str] | None = None
    score = 0
    for token, count in tokens.items():
        if _LATIN_RE.fullmatch(token):
            if latin_terms is None:
                latin_terms = set(_LATIN_RE.findall(haystack))
            matched = token in latin_terms
        else:
            matched = token in haystack
        if matched:
            score += count * weight
    return score


def _is_strong_token(token: str) -> bool:
    if token in _GENERIC_TOKENS:
        return False
    if _LATIN_RE.fullmatch(token):
        return len(token) >= 2
    return len(token) >= 2


def _keyword_score_parts(query: str, doc: dict) -> tuple[int, int]:
    tokens = Counter(_expanded_query_tokens(query))
    strong_tokens = Counter(
        token for token in tokens.elements() if _is_strong_token(token)
    )
    metadata = " ".join(
        str(doc.get(key) or "")
        for key in (
            "project_name",
            "file_name",
            "project_relative_path",
            "source_relative_path",
        )
    )
    description = str(doc.get("doc_description") or "")
    structure_text = _structure_search_text(doc.get("structure", []))
    weighted_fields = [
        (metadata, 6),
        (description, 3),
        (structure_text, 2),
    ]
    score = sum(
        _weighted_token_score(tokens, text, weight=weight)
        for text, weight in weighted_fields
    )
    strong_score = sum(
        _weighted_token_score(strong_tokens, text, weight=weight)
        for text, weight in weighted_fields
    )
    return score, strong_score


def keyword_score(query: str, doc: dict) -> int:
    score, _strong_score = _keyword_score_parts(query, doc)
    return score


def _has_strong_query_signal(query: str) -> bool:
    return any(_is_strong_token(token) for token in _expanded_query_tokens(query))


def _passes_prefilter(query: str, score: int, strong_score: int) -> bool:
    if score <= 0:
        return False
    if not _has_strong_query_signal(query):
        return True
    return strong_score >= MIN_STRONG_PREFILTER_SCORE


def _rank_documents_by_keyword(
    query: str,
    docs: list[dict],
) -> list[tuple[int, int, str, dict]]:
    ranked = [
        (
            score,
            strong_score,
            str(doc.get("file_name") or ""),
            doc,
        )
        for doc in docs
        for score, strong_score in [_keyword_score_parts(query, doc)]
    ]
    return sorted(ranked, key=lambda item: (item[0], item[1], item[2]), reverse=True)


def _keyword_select_documents(query: str, docs: list[dict], limit: int) -> list[dict]:
    ranked = _rank_documents_by_keyword(query, docs)
    positives = [
        doc
        for score, strong_score, _file_name, doc in ranked
        if _passes_prefilter(query, score, strong_score)
    ]
    if positives:
        return positives[:limit]

    return [
        doc
        for score, _strong_score, _file_name, doc in ranked
        if score > 0
    ][:limit]


def prefilter_candidate_documents(
    query: str,
    docs: list[dict],
    *,
    limit: int = DEFAULT_PREFILTER_LIMIT,
) -> list[dict]:
    if limit <= 0 or not docs:
        return []
    ranked = _rank_documents_by_keyword(query, docs)
    positives = [
        doc
        for score, strong_score, _file_name, doc in ranked
        if _passes_prefilter(query, score, strong_score)
    ]
    if positives:
        return positives[:limit]

    weak_matches = [
        doc
        for score, _strong_score, _file_name, doc in ranked
        if score > 0
    ]
    if weak_matches:
        return weak_matches[:limit]

    return [doc for _score, _strong_score, _file_name, doc in ranked[:limit]]


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

    llm_candidates = prefilter_candidate_documents(
        query,
        docs,
        limit=DEFAULT_PREFILTER_LIMIT,
    )

    llm_selected = _llm_select_documents(query, llm_candidates, limit=limit, model=model)
    if llm_selected is not None:
        return llm_selected

    return _keyword_select_documents(query, llm_candidates, limit)
