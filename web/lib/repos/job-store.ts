import crypto from "node:crypto";
import Database from "better-sqlite3";

function open(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}

export function createIndexJob(dbPath: string, documentId: string) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  const row = {
    id: `job_${crypto.randomUUID()}`,
    type: "document_index",
    document_id: documentId,
    payload_json: JSON.stringify({ documentId }),
    status: "queued",
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `INSERT INTO jobs (
      id, type, document_id, payload_json, status, created_at, updated_at
    ) VALUES (
      @id, @type, @document_id, @payload_json, @status, @created_at, @updated_at
    )`,
  ).run(row);

  db.close();
  return {
    id: row.id,
    status: row.status,
  };
}

export function getJob(dbPath: string, jobId: string) {
  const db = open(dbPath);
  const row = db
    .prepare(`SELECT id, status, progress, error_message FROM jobs WHERE id = ?`)
    .get(jobId) as
    | { id: string; status: string; progress: number; error_message: string | null }
    | undefined;

  db.close();
  return row
    ? {
        id: row.id,
        status: row.status,
        progress: row.progress,
        error: row.error_message,
      }
    : null;
}
