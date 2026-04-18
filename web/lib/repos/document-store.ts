import crypto from "node:crypto";
import Database from "better-sqlite3";

function open(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}

export function createDocumentRecord(
  dbPath: string,
  input: {
    ownerUserId: string;
    projectId: string;
    fileName: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
  },
) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  const row = {
    id: `doc_${crypto.randomUUID()}`,
    project_id: input.projectId,
    owner_user_id: input.ownerUserId,
    file_name: input.fileName,
    storage_path: input.storagePath,
    mime_type: input.mimeType,
    file_size: input.fileSize,
    status: "uploaded",
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `INSERT INTO documents (
       id, project_id, owner_user_id, file_name, storage_path, mime_type,
       file_size, status, created_at, updated_at
     ) VALUES (
       @id, @project_id, @owner_user_id, @file_name, @storage_path, @mime_type,
       @file_size, @status, @created_at, @updated_at
     )`,
  ).run(row);

  db.close();
  return {
    id: row.id,
    projectId: row.project_id,
    fileName: row.file_name,
    status: row.status,
  };
}

function parsePagesFilter(pages: string | null) {
  if (!pages) return null;

  const selected = new Set<number>();
  for (const part of pages.split(",")) {
    const token = part.trim();
    if (!token) continue;

    if (token.includes("-")) {
      const [startText, endText] = token.split("-", 2);
      const start = Number(startText);
      const end = Number(endText);
      for (let page = start; page <= end; page += 1) {
        selected.add(page);
      }
      continue;
    }

    selected.add(Number(token));
  }

  return selected;
}

export function listDocumentsByProject(dbPath: string, projectId: string) {
  const db = open(dbPath);
  const rows = db
    .prepare(
      `SELECT id, file_name, page_count, status, created_at, updated_at
         FROM documents
        WHERE project_id = ?
          AND deleted_at IS NULL
        ORDER BY created_at DESC`,
    )
    .all(projectId) as Array<{
    id: string;
    file_name: string;
    page_count: number | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>;

  db.close();
  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    pageCount: row.page_count ?? 0,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getDocumentDetail(dbPath: string, documentId: string) {
  const db = open(dbPath);
  const row = db
    .prepare(
      `SELECT d.id, d.project_id, d.file_name, d.storage_path, d.mime_type,
              d.file_size, d.page_count, d.status, d.error_message, d.created_at,
              d.updated_at, p.name AS project_name
         FROM documents d
         JOIN projects p ON p.id = d.project_id
        WHERE d.id = ?
          AND d.deleted_at IS NULL`,
    )
    .get(documentId) as
    | {
        id: string;
        project_id: string;
        file_name: string;
        storage_path: string;
        mime_type: string;
        file_size: number;
        page_count: number | null;
        status: string;
        error_message: string | null;
        created_at: string;
        updated_at: string;
        project_name: string;
      }
    | undefined;

  db.close();
  return row
    ? {
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        fileName: row.file_name,
        storagePath: row.storage_path,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        pageCount: row.page_count ?? 0,
        status: row.status,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

export function getDocumentStructure(dbPath: string, documentId: string) {
  const db = open(dbPath);
  const row = db
    .prepare(`SELECT structure_json FROM document_indexes WHERE document_id = ?`)
    .get(documentId) as { structure_json: string } | undefined;

  db.close();
  return row ? JSON.parse(row.structure_json) : [];
}

export function getDocumentPages(
  dbPath: string,
  documentId: string,
  pages: string | null,
) {
  const db = open(dbPath);
  const row = db
    .prepare(`SELECT pages_json FROM document_indexes WHERE document_id = ?`)
    .get(documentId) as { pages_json: string } | undefined;

  db.close();
  if (!row) return [];

  const parsed = JSON.parse(row.pages_json) as Array<{
    page: number;
    content: string;
  }>;
  const allowed = parsePagesFilter(pages);
  return allowed ? parsed.filter((entry) => allowed.has(entry.page)) : parsed;
}
