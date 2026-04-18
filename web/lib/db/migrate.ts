import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "@/lib/config";

export function migrateDatabase(dbPath: string) {
  const schemaPath = path.join(process.cwd(), "lib", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const db = new Database(dbPath);
  db.exec(schemaSql);
  db.close();
}

if (import.meta.main) {
  fs.mkdirSync(path.dirname(appConfig.dbPath), { recursive: true });
  migrateDatabase(appConfig.dbPath);
  console.log(`migrated ${appConfig.dbPath}`);
}
