import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/lib/db/migrate";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("migrateDatabase", () => {
  it("creates the project chat tables", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-migrate-"));
    tempDirs.push(dir);

    const dbPath = path.join(dir, "app.db");
    migrateDatabase(dbPath);

    const db = new Database(dbPath, { readonly: true });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row: { name: string }) => row.name);

    expect(tables).toEqual(
      expect.arrayContaining([
        "projects",
        "documents",
        "document_indexes",
        "conversations",
        "conversation_projects",
        "conversation_messages",
        "jobs",
      ]),
    );
  });
});
