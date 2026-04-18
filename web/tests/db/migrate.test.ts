import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/lib/db/migrate";

const tempDirs: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
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

    db.close();
  });

  it("creates parent directories for a nested db path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-migrate-parent-"));
    tempDirs.push(dir);

    const dbPath = path.join(dir, "nested", "deeper", "app.db");
    migrateDatabase(dbPath);

    expect(fs.existsSync(path.dirname(dbPath))).toBe(true);
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("resolves schema independently of cwd and is safe to run twice", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-migrate-cwd-"));
    tempDirs.push(dir);

    const dbPath = path.join(dir, "app.db");
    const unrelatedCwd = path.join(dir, "other-working-dir");
    fs.mkdirSync(unrelatedCwd, { recursive: true });

    process.chdir(unrelatedCwd);
    migrateDatabase(dbPath);
    migrateDatabase(dbPath);

    const db = new Database(dbPath, { readonly: true });
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get("projects") as { name: string } | undefined;

    expect(table?.name).toBe("projects");
    db.close();
  });
});
