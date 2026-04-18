import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { appConfig } from "@/lib/config";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(moduleDir, "schema.sql");

export function migrateDatabase(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const db = new Database(dbPath);
  db.exec(schemaSql);
  db.close();
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
