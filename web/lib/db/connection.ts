import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "@/lib/config";

let db: InstanceType<typeof Database> | null = null;

export function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(appConfig.dbPath), { recursive: true });
  db = new Database(appConfig.dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}
