import json
from datetime import datetime, timezone

from PyPDF2 import PdfReader

from pageindex.page_index import page_index
from services.common.models import IndexedDocumentPayload
from services.common.sqlite_store import open_db


def build_pageindex_payload(file_path: str) -> IndexedDocumentPayload:
    result = page_index(
        doc=file_path,
        if_add_node_summary="yes",
        if_add_node_text="yes",
        if_add_node_id="yes",
        if_add_doc_description="yes",
    )
    reader = PdfReader(file_path)
    pages = [
        {"page": index + 1, "content": page.extract_text() or ""}
        for index, page in enumerate(reader.pages)
    ]
    return {
        "doc_name": result["doc_name"],
        "doc_description": result.get("doc_description", ""),
        "structure": result["structure"],
        "pages": pages,
        "page_count": len(pages),
    }


def process_document_job(db_path: str, job_id: str):
    now = datetime.now(timezone.utc).isoformat()

    with open_db(db_path) as conn:
        row = conn.execute(
            """
            SELECT j.id AS job_id, d.id AS document_id, d.storage_path
            FROM jobs j
            JOIN documents d ON d.id = j.document_id
            WHERE j.id = ?
              AND j.type = 'document_index'
              AND j.status = 'running'
            """,
            (job_id,),
        ).fetchone()

        if row is None:
            raise ValueError(f"Job {job_id} not found")

        payload = build_pageindex_payload(row["storage_path"])

        conn.execute(
            """
            INSERT INTO document_indexes (
              id, document_id, doc_name, doc_description, structure_json,
              pages_json, index_version, indexed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET
              doc_name = excluded.doc_name,
              doc_description = excluded.doc_description,
              structure_json = excluded.structure_json,
              pages_json = excluded.pages_json,
              index_version = excluded.index_version,
              indexed_at = excluded.indexed_at
            """,
            (
                f"idx_{row['document_id']}",
                row["document_id"],
                payload["doc_name"],
                payload["doc_description"],
                json.dumps(payload["structure"], ensure_ascii=False),
                json.dumps(payload["pages"], ensure_ascii=False),
                "v1",
                now,
            ),
        )

        conn.execute(
            """
            UPDATE documents
               SET status = ?, page_count = ?, error_message = NULL, updated_at = ?
             WHERE id = ?
            """,
            ("ready", payload["page_count"], now, row["document_id"]),
        )
        conn.execute(
            """
            UPDATE jobs
               SET status = ?, progress = ?, updated_at = ?, finished_at = ?, error_message = NULL
             WHERE id = ?
            """,
            ("completed", 100, now, now, job_id),
        )
