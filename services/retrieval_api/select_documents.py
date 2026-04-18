from collections import Counter


def keyword_score(query: str, doc: dict) -> int:
    tokens = [token for token in query.lower().split() if token]
    haystack = f"{doc.get('file_name', '')} {doc.get('doc_description', '')}".lower()
    counts = Counter(tokens)
    return sum(weight for token, weight in counts.items() if token in haystack)


def select_candidate_documents(query: str, docs: list[dict], limit: int = 8) -> list[dict]:
    ranked = sorted(
        docs,
        key=lambda doc: (keyword_score(query, doc), doc.get("file_name", "")),
        reverse=True,
    )
    return [doc for doc in ranked if keyword_score(query, doc) > 0][:limit]
