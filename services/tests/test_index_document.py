import json
import sqlite3
from pathlib import Path

from services.index_worker.index_document import process_document_job


def test_process_document_job_marks_document_ready(tmp_path, monkeypatch):
    db_path = tmp_path / "app.db"
    schema = Path("web/lib/db/schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)

    conn.execute(
        "INSERT INTO projects (id, owner_user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        ("proj_1", "user_demo", "Alpha", "2026-04-19T00:00:00Z", "2026-04-19T00:00:00Z"),
    )
    conn.execute(
        """INSERT INTO documents
           (id, project_id, owner_user_id, file_name, storage_path, mime_type, file_size, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            "doc_1",
            "proj_1",
            "user_demo",
            "alpha.pdf",
            str(tmp_path / "alpha.pdf"),
            "application/pdf",
            100,
            "indexing",
            "2026-04-19T00:00:00Z",
            "2026-04-19T00:00:00Z",
        ),
    )
    conn.execute(
        """INSERT INTO jobs
           (id, type, document_id, payload_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            "job_1",
            "document_index",
            "doc_1",
            json.dumps({"documentId": "doc_1"}),
            "running",
            "2026-04-19T00:00:00Z",
            "2026-04-19T00:00:00Z",
        ),
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(
        "services.index_worker.index_document.build_pageindex_payload",
        lambda file_path: {
            "doc_name": "alpha.pdf",
            "doc_description": "Alpha test document",
            "structure": [{"title": "Intro", "node_id": "0001", "start_index": 1, "end_index": 1, "summary": "Intro"}],
            "pages": [{"page": 1, "content": "hello"}],
            "page_count": 1,
        },
    )

    process_document_job(str(db_path), "job_1")

    conn = sqlite3.connect(db_path)
    status = conn.execute("SELECT status, page_count FROM documents WHERE id = 'doc_1'").fetchone()
    index_row = conn.execute("SELECT doc_name, doc_description FROM document_indexes WHERE document_id = 'doc_1'").fetchone()
    job_status = conn.execute("SELECT status FROM jobs WHERE id = 'job_1'").fetchone()
    conn.close()

    assert status == ("ready", 1)
    assert index_row == ("alpha.pdf", "Alpha test document")
    assert job_status == ("completed",)
