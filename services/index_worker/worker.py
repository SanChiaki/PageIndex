import time
from datetime import datetime, timezone

from services.common.settings import DB_PATH
from services.common.sqlite_store import open_db
from services.index_worker.index_document import process_document_job


def claim_next_job(db_path: str):
    now = datetime.now(timezone.utc).isoformat()
    with open_db(db_path) as conn:
        row = conn.execute(
            """
            SELECT id
              FROM jobs
             WHERE type = 'document_index'
               AND status = 'queued'
             ORDER BY created_at ASC
             LIMIT 1
            """
        ).fetchone()
        if row is None:
            return None

        conn.execute(
            "UPDATE jobs SET status = 'running', progress = 5, updated_at = ? WHERE id = ?",
            (now, row["id"]),
        )
        conn.execute(
            """
            UPDATE documents
               SET status = 'indexing', updated_at = ?
             WHERE id = (SELECT document_id FROM jobs WHERE id = ?)
            """,
            (now, row["id"]),
        )
        return row["id"]


def run_forever(poll_seconds: float = 2.0):
    while True:
        job_id = claim_next_job(str(DB_PATH))
        if job_id is None:
            time.sleep(poll_seconds)
            continue
        try:
            process_document_job(str(DB_PATH), job_id)
        except Exception as exc:
            now = datetime.now(timezone.utc).isoformat()
            with open_db(str(DB_PATH)) as conn:
                conn.execute(
                    "UPDATE jobs SET status = 'failed', error_message = ?, updated_at = ?, finished_at = ? WHERE id = ?",
                    (str(exc), now, now, job_id),
                )
                conn.execute(
                    """
                    UPDATE documents
                       SET status = 'failed', error_message = ?, updated_at = ?
                     WHERE id = (SELECT document_id FROM jobs WHERE id = ?)
                    """,
                    (str(exc), now, job_id),
                )


if __name__ == "__main__":
    run_forever()
