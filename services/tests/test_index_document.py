import json
import sqlite3
from pathlib import Path

import pytest

from services.common.sqlite_store import open_db
from services.index_worker.index_document import process_document_job
from services.index_worker.worker import claim_next_job


def _schema_sql() -> str:
    repo_root = Path(__file__).resolve().parents[2]
    schema_path = repo_root / "web" / "lib" / "db" / "schema.sql"
    return schema_path.read_text(encoding="utf-8")


def _seed_single_document_job_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "app.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(_schema_sql())

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
    return db_path


def test_process_document_job_marks_document_ready(tmp_path, monkeypatch):
    db_path = _seed_single_document_job_db(tmp_path)

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


def test_process_document_job_reindex_is_idempotent_for_same_document(tmp_path, monkeypatch):
    db_path = _seed_single_document_job_db(tmp_path)
    payloads = iter(
        [
            {
                "doc_name": "alpha-v1.pdf",
                "doc_description": "Alpha test document v1",
                "structure": [{"title": "Intro"}],
                "pages": [{"page": 1, "content": "hello"}],
                "page_count": 1,
            },
            {
                "doc_name": "alpha-v2.pdf",
                "doc_description": "Alpha test document v2",
                "structure": [{"title": "Updated"}],
                "pages": [{"page": 1, "content": "hello again"}],
                "page_count": 1,
            },
        ]
    )
    monkeypatch.setattr(
        "services.index_worker.index_document.build_pageindex_payload",
        lambda file_path: next(payloads),
    )

    process_document_job(str(db_path), "job_1")
    conn = sqlite3.connect(db_path)
    conn.execute(
        "UPDATE jobs SET status = 'running', progress = 50, error_message = 'old error', finished_at = NULL WHERE id = 'job_1'"
    )
    conn.execute(
        "UPDATE documents SET status = 'indexing', error_message = 'stale doc error' WHERE id = 'doc_1'"
    )
    conn.commit()
    conn.close()
    process_document_job(str(db_path), "job_1")

    conn = sqlite3.connect(db_path)
    row_count = conn.execute("SELECT COUNT(*) FROM document_indexes WHERE document_id = 'doc_1'").fetchone()[0]
    index_row = conn.execute(
        "SELECT doc_name, doc_description FROM document_indexes WHERE document_id = 'doc_1'"
    ).fetchone()
    job_row = conn.execute("SELECT status, error_message, finished_at FROM jobs WHERE id = 'job_1'").fetchone()
    document_row = conn.execute("SELECT status, error_message FROM documents WHERE id = 'doc_1'").fetchone()
    conn.close()

    assert row_count == 1
    assert index_row == ("alpha-v2.pdf", "Alpha test document v2")
    assert job_row[0] == "completed"
    assert job_row[1] is None
    assert job_row[2] is not None
    assert document_row == ("ready", None)


def test_process_document_job_updates_legacy_index_row_with_same_document_id(tmp_path, monkeypatch):
    db_path = _seed_single_document_job_db(tmp_path)
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO document_indexes (
          id, document_id, doc_name, doc_description, structure_json,
          pages_json, index_version, indexed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "legacy_idx_1",
            "doc_1",
            "legacy-name.pdf",
            "legacy description",
            json.dumps([{"title": "Legacy"}]),
            json.dumps([{"page": 1, "content": "legacy"}]),
            "v0",
            "2026-04-19T00:00:00Z",
        ),
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(
        "services.index_worker.index_document.build_pageindex_payload",
        lambda file_path: {
            "doc_name": "alpha-new.pdf",
            "doc_description": "new description",
            "structure": [{"title": "Updated"}],
            "pages": [{"page": 1, "content": "new"}],
            "page_count": 1,
        },
    )

    process_document_job(str(db_path), "job_1")

    conn = sqlite3.connect(db_path)
    row_count = conn.execute("SELECT COUNT(*) FROM document_indexes WHERE document_id = 'doc_1'").fetchone()[0]
    index_row = conn.execute(
        "SELECT id, doc_name, doc_description FROM document_indexes WHERE document_id = 'doc_1'"
    ).fetchone()
    conn.close()

    assert row_count == 1
    assert index_row == ("legacy_idx_1", "alpha-new.pdf", "new description")


def test_process_document_job_requires_running_document_index_job(tmp_path):
    db_path = _seed_single_document_job_db(tmp_path)

    conn = sqlite3.connect(db_path)
    conn.execute("UPDATE jobs SET type = 'other_job', status = 'queued' WHERE id = 'job_1'")
    conn.commit()
    conn.close()

    try:
        process_document_job(str(db_path), "job_1")
    except ValueError as exc:
        assert "not found" in str(exc)
    else:
        raise AssertionError("expected ValueError for non-running document_index job")


def test_claim_next_job_claims_queued_jobs_in_order(tmp_path):
    db_path = tmp_path / "app.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(_schema_sql())
    conn.execute(
        "INSERT INTO projects (id, owner_user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        ("proj_1", "user_demo", "Alpha", "2026-04-19T00:00:00Z", "2026-04-19T00:00:00Z"),
    )
    conn.executemany(
        """INSERT INTO documents
           (id, project_id, owner_user_id, file_name, storage_path, mime_type, file_size, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            (
                "doc_1",
                "proj_1",
                "user_demo",
                "alpha.pdf",
                str(tmp_path / "alpha.pdf"),
                "application/pdf",
                100,
                "uploaded",
                "2026-04-19T00:00:00Z",
                "2026-04-19T00:00:00Z",
            ),
            (
                "doc_2",
                "proj_1",
                "user_demo",
                "beta.pdf",
                str(tmp_path / "beta.pdf"),
                "application/pdf",
                120,
                "uploaded",
                "2026-04-19T00:00:01Z",
                "2026-04-19T00:00:01Z",
            ),
        ],
    )
    conn.executemany(
        """INSERT INTO jobs
           (id, type, document_id, payload_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [
            (
                "job_1",
                "document_index",
                "doc_1",
                json.dumps({"documentId": "doc_1"}),
                "queued",
                "2026-04-19T00:00:00Z",
                "2026-04-19T00:00:00Z",
            ),
            (
                "job_2",
                "document_index",
                "doc_2",
                json.dumps({"documentId": "doc_2"}),
                "queued",
                "2026-04-19T00:00:01Z",
                "2026-04-19T00:00:01Z",
            ),
            (
                "job_3",
                "other_job",
                "doc_2",
                json.dumps({"documentId": "doc_2"}),
                "queued",
                "2026-04-19T00:00:02Z",
                "2026-04-19T00:00:02Z",
            ),
        ],
    )
    conn.commit()
    conn.close()

    first = claim_next_job(str(db_path))
    second = claim_next_job(str(db_path))
    third = claim_next_job(str(db_path))

    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT id, status, progress FROM jobs ORDER BY id").fetchall()
    doc_rows = conn.execute("SELECT id, status FROM documents ORDER BY id").fetchall()
    conn.close()

    assert first == "job_1"
    assert second == "job_2"
    assert third is None
    assert rows == [
        ("job_1", "running", 5),
        ("job_2", "running", 5),
        ("job_3", "queued", 0),
    ]
    assert doc_rows == [("doc_1", "indexing"), ("doc_2", "indexing")]


def test_open_db_enables_foreign_keys_and_busy_timeout(tmp_path):
    db_path = tmp_path / "app.db"

    with open_db(str(db_path)) as conn:
        foreign_keys = conn.execute("PRAGMA foreign_keys").fetchone()[0]
        busy_timeout = conn.execute("PRAGMA busy_timeout").fetchone()[0]

    assert foreign_keys == 1
    assert busy_timeout >= 5000


def test_open_db_rolls_back_on_exception(tmp_path):
    db_path = tmp_path / "app.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(_schema_sql())
    conn.close()

    with pytest.raises(RuntimeError):
        with open_db(str(db_path)) as writable:
            writable.execute(
                "INSERT INTO projects (id, owner_user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                ("proj_x", "user_demo", "Rollback Test", "2026-04-19T00:00:00Z", "2026-04-19T00:00:00Z"),
            )
            raise RuntimeError("force rollback")

    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM projects WHERE id = 'proj_x'").fetchone()[0]
    conn.close()
    assert count == 0
