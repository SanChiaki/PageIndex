import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { appConfig } from "@/lib/config";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(moduleDir, "schema.sql");

type SqliteDatabase = {
  exec(sql: string): unknown;
  prepare(sql: string): {
    all(): unknown[];
  };
};

export function migrateDatabase(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const db = new Database(dbPath);
  try {
    db.exec(schemaSql);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("no such column")
    ) {
      ensureLegacyColumns(db);
      db.exec(schemaSql);
    } else {
      throw error;
    }
  }
  ensureLegacyColumns(db);
  db.close();
}

function ensureColumn(
  db: SqliteDatabase,
  table: string,
  column: string,
  ddl: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function ensureLegacyColumns(db: SqliteDatabase) {
  const documentColumns: Array<[string, string]> = [
    ["source_kind", "source_kind TEXT NOT NULL DEFAULT 'upload'"],
    ["source_root", "source_root TEXT"],
    ["source_relative_path", "source_relative_path TEXT"],
    ["project_relative_path", "project_relative_path TEXT"],
    ["content_hash", "content_hash TEXT"],
    ["source_mtime", "source_mtime TEXT"],
    ["source_size", "source_size INTEGER"],
    ["media_type", "media_type TEXT NOT NULL DEFAULT 'pdf'"],
    ["import_status", "import_status TEXT NOT NULL DEFAULT 'imported'"],
    ["import_error", "import_error TEXT"],
    ["last_index_duration_ms", "last_index_duration_ms INTEGER"],
    ["last_index_total_tokens", "last_index_total_tokens INTEGER"],
    ["last_index_llm_call_count", "last_index_llm_call_count INTEGER"],
    ["last_indexed_at", "last_indexed_at TEXT"],
  ];
  for (const [column, ddl] of documentColumns) {
    ensureColumn(db, "documents", column, ddl);
  }

  const indexColumns: Array<[string, string]> = [
    ["evidence_kind", "evidence_kind TEXT NOT NULL DEFAULT 'pdf_text'"],
    ["visual_assets_json", "visual_assets_json TEXT NOT NULL DEFAULT '[]'"],
    ["source_metadata_json", "source_metadata_json TEXT NOT NULL DEFAULT '{}'"],
  ];
  for (const [column, ddl] of indexColumns) {
    ensureColumn(db, "document_indexes", column, ddl);
  }
}

function isMainModule() {
  const entryPath = process.argv[1];
  if (!entryPath) return false;
  return fileURLToPath(import.meta.url) === path.resolve(entryPath);
}

if (isMainModule()) {
  fs.mkdirSync(path.dirname(appConfig.dbPath), { recursive: true });
  migrateDatabase(appConfig.dbPath);
  console.log(`migrated ${appConfig.dbPath}`);
}
