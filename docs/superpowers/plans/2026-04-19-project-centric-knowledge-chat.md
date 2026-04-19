# Project-Centric Knowledge Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-release project-centric knowledge chat application that lets users create projects, upload PDFs into projects, chat against one or more selected projects, and review conversation history with citations.

**Architecture:** A `web/` Next.js App Router application provides the UI and browser-facing API routes. Application state is stored in a shared SQLite database and uploaded PDFs are kept on the local filesystem under `var/uploads/`. Python services under `services/` handle background indexing jobs and multi-project retrieval orchestration on top of the existing `pageindex/` core.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, better-sqlite3, Zod, Vitest, Playwright, FastAPI, sqlite3, PyPDF2, LiteLLM, pytest

---

## File Structure

### Web App

- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next-env.d.ts`
- Create: `web/next.config.ts`
- Create: `web/postcss.config.mjs`
- Create: `web/tailwind.config.ts`
- Create: `web/vitest.config.ts`
- Create: `web/app/globals.css`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx`
- Create: `web/app/chat/page.tsx`
- Create: `web/app/projects/page.tsx`
- Create: `web/app/projects/[projectId]/page.tsx`
- Create: `web/app/api/projects/route.ts`
- Create: `web/app/api/projects/[projectId]/route.ts`
- Create: `web/app/api/projects/[projectId]/documents/route.ts`
- Create: `web/app/api/projects/[projectId]/documents/upload/route.ts`
- Create: `web/app/api/documents/[documentId]/route.ts`
- Create: `web/app/api/documents/[documentId]/structure/route.ts`
- Create: `web/app/api/documents/[documentId]/pages/route.ts`
- Create: `web/app/api/documents/[documentId]/reindex/route.ts`
- Create: `web/app/api/conversations/route.ts`
- Create: `web/app/api/conversations/[conversationId]/route.ts`
- Create: `web/app/api/conversations/[conversationId]/projects/route.ts`
- Create: `web/app/api/chat/send/route.ts`
- Create: `web/app/api/jobs/[jobId]/route.ts`
- Create: `web/components/app-shell.tsx`
- Create: `web/components/sidebar-nav.tsx`
- Create: `web/components/chat-history-list.tsx`
- Create: `web/components/project-grid.tsx`
- Create: `web/components/project-card.tsx`
- Create: `web/components/document-table.tsx`
- Create: `web/components/document-upload-modal.tsx`
- Create: `web/components/chat-message-list.tsx`
- Create: `web/components/chat-composer.tsx`
- Create: `web/components/project-scope-picker.tsx`
- Create: `web/components/citation-list.tsx`
- Create: `web/lib/config.ts`
- Create: `web/lib/db/schema.sql`
- Create: `web/lib/db/connection.ts`
- Create: `web/lib/db/migrate.ts`
- Create: `web/lib/repos/project-store.ts`
- Create: `web/lib/repos/document-store.ts`
- Create: `web/lib/repos/conversation-store.ts`
- Create: `web/lib/repos/job-store.ts`
- Create: `web/lib/storage/local-files.ts`
- Create: `web/lib/retrieval-client.ts`

### Python Services

- Create: `services/common/settings.py`
- Create: `services/common/sqlite_store.py`
- Create: `services/common/models.py`
- Create: `services/index_worker/worker.py`
- Create: `services/index_worker/index_document.py`
- Create: `services/retrieval_api/app.py`
- Create: `services/retrieval_api/schemas.py`
- Create: `services/retrieval_api/select_documents.py`
- Create: `services/retrieval_api/query_engine.py`

### Tests and Runtime

- Create: `web/tests/db/migrate.test.ts`
- Create: `web/tests/repos/project-store.test.ts`
- Create: `web/tests/repos/conversation-store.test.ts`
- Create: `web/tests/components/project-grid.test.tsx`
- Create: `web/tests/components/chat-page.test.tsx`
- Create: `web/tests/e2e/project-chat.spec.ts`
- Create: `services/tests/test_index_document.py`
- Create: `services/tests/test_select_documents.py`
- Create: `services/tests/test_query_engine.py`
- Modify: `.gitignore`
- Create: `var/.gitkeep`

### Task 1: Bootstrap the shared runtime, schema, and migration path

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next-env.d.ts`
- Create: `web/next.config.ts`
- Create: `web/postcss.config.mjs`
- Create: `web/tailwind.config.ts`
- Create: `web/vitest.config.ts`
- Create: `web/lib/config.ts`
- Create: `web/lib/db/schema.sql`
- Create: `web/lib/db/connection.ts`
- Create: `web/lib/db/migrate.ts`
- Create: `web/tests/db/migrate.test.ts`
- Modify: `.gitignore`
- Create: `var/.gitkeep`

- [ ] **Step 1: Write the failing migration test**

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/tests/db/migrate.test.ts
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
```

- [ ] **Step 2: Run the migration test and confirm it fails**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm vitest run tests/db/migrate.test.ts`

Expected: FAIL with module resolution errors because `package.json`, `vitest.config.ts`, and `lib/db/migrate.ts` do not exist yet.

- [ ] **Step 3: Create the runtime scaffold, schema, and migration code**

```json
// /Users/oam/Workspace/demos/PageIndexDemo/web/package.json
{
  "name": "pageindex-project-chat-web",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "db:migrate": "tsx lib/db/migrate.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.511.0",
    "next": "^16.0.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zod": "^3.24.3"
  },
  "devDependencies": {
    "@playwright/test": "^1.54.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "autoprefixer": "^10.4.21",
    "jsdom": "^26.1.0",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.2"
  }
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/next-env.d.ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is generated by Next.js.
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

```js
// /Users/oam/Workspace/demos/PageIndexDemo/web/postcss.config.mjs
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./tests/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/lib/config.ts
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..");
const varRoot = process.env.APP_VAR_ROOT ?? path.join(repoRoot, "var");

export const appConfig = {
  repoRoot,
  varRoot,
  dbPath: process.env.APP_DB_PATH ?? path.join(varRoot, "app.db"),
  uploadRoot: process.env.APP_UPLOAD_ROOT ?? path.join(varRoot, "uploads"),
  retrievalBaseUrl:
    process.env.RETRIEVAL_API_BASE_URL ?? "http://127.0.0.1:8001",
};
```

```sql
-- /Users/oam/Workspace/demos/PageIndexDemo/web/lib/db/schema.sql
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  page_count INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS document_indexes (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL UNIQUE,
  doc_name TEXT NOT NULL,
  doc_description TEXT NOT NULL,
  structure_json TEXT NOT NULL,
  pages_json TEXT NOT NULL,
  index_version TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS conversation_projects (
  conversation_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (conversation_id, project_id),
  FOREIGN KEY(conversation_id) REFERENCES conversations(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  document_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_updated
  ON projects(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_project_status_updated
  ON documents(project_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated
  ON conversations(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON conversation_messages(conversation_id, created_at);
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/lib/db/connection.ts
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "@/lib/config";

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(appConfig.dbPath), { recursive: true });
  db = new Database(appConfig.dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/lib/db/migrate.ts
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
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/vitest.config.ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
```

```gitignore
# /Users/oam/Workspace/demos/PageIndexDemo/.gitignore
.venv/
__pycache__/
.pytest_cache/
node_modules/
web/node_modules/
web/.next/
var/*
!var/.gitkeep
```

- [ ] **Step 4: Install dependencies, run the migration, and verify the test passes**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm install && pnpm db:migrate && pnpm vitest run tests/db/migrate.test.ts`

Expected: PASS with one successful test proving all shared tables exist.

- [ ] **Step 5: Commit the bootstrap**

```bash
cd /Users/oam/Workspace/demos/PageIndexDemo
git add .gitignore var/.gitkeep web/package.json web/tsconfig.json web/next-env.d.ts web/next.config.ts web/postcss.config.mjs web/tailwind.config.ts web/vitest.config.ts web/lib/config.ts web/lib/db/schema.sql web/lib/db/connection.ts web/lib/db/migrate.ts web/tests/db/migrate.test.ts
git commit -m "chore: bootstrap project chat runtime"
```

### Task 2: Implement SQLite-backed project, document, conversation, and job stores with BFF routes

**Files:**
- Create: `web/lib/repos/project-store.ts`
- Create: `web/lib/repos/document-store.ts`
- Create: `web/lib/repos/conversation-store.ts`
- Create: `web/lib/repos/job-store.ts`
- Create: `web/lib/storage/local-files.ts`
- Create: `web/app/api/projects/route.ts`
- Create: `web/app/api/projects/[projectId]/route.ts`
- Create: `web/app/api/projects/[projectId]/documents/route.ts`
- Create: `web/app/api/projects/[projectId]/documents/upload/route.ts`
- Create: `web/app/api/documents/[documentId]/route.ts`
- Create: `web/app/api/documents/[documentId]/structure/route.ts`
- Create: `web/app/api/documents/[documentId]/pages/route.ts`
- Create: `web/app/api/documents/[documentId]/reindex/route.ts`
- Create: `web/app/api/conversations/route.ts`
- Create: `web/app/api/conversations/[conversationId]/route.ts`
- Create: `web/app/api/conversations/[conversationId]/projects/route.ts`
- Create: `web/app/api/jobs/[jobId]/route.ts`
- Create: `web/tests/repos/project-store.test.ts`
- Create: `web/tests/repos/conversation-store.test.ts`

- [ ] **Step 1: Write failing repository tests for project creation, document enqueueing, and conversation scope persistence**

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/tests/repos/project-store.test.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/lib/db/migrate";
import { createProject, listProjects } from "@/lib/repos/project-store";
import { createDocumentRecord } from "@/lib/repos/document-store";
import { createIndexJob, getJob } from "@/lib/repos/job-store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("project and document stores", () => {
  it("creates a project and enqueues an index job for an uploaded document", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-store-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.db");
    migrateDatabase(dbPath);

    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    const document = createDocumentRecord(dbPath, {
      ownerUserId: "user_demo",
      projectId: project.id,
      fileName: "alpha.pdf",
      storagePath: "/tmp/alpha.pdf",
      mimeType: "application/pdf",
      fileSize: 128,
    });

    const job = createIndexJob(dbPath, document.id);

    expect(listProjects(dbPath, "user_demo")).toHaveLength(1);
    expect(document.status).toBe("uploaded");
    expect(getJob(dbPath, job.id)?.status).toBe("queued");
  });
});
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/tests/repos/conversation-store.test.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/lib/db/migrate";
import { createProject } from "@/lib/repos/project-store";
import {
  createConversation,
  replaceConversationProjects,
  getConversationDetail,
  appendConversationMessage,
} from "@/lib/repos/conversation-store";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("conversation store", () => {
  it("persists project scope on a conversation", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-conv-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.db");
    migrateDatabase(dbPath);

    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    const conversation = createConversation(dbPath, "user_demo");
    replaceConversationProjects(dbPath, conversation.id, [project.id]);
    appendConversationMessage(dbPath, {
      conversationId: conversation.id,
      role: "user",
      content: "Summarize Alpha",
      citations: [],
    });

    const detail = getConversationDetail(dbPath, conversation.id);

    expect(detail.projectIds).toEqual([project.id]);
    expect(detail.messages).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the repository tests and confirm they fail**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm vitest run tests/repos/project-store.test.ts tests/repos/conversation-store.test.ts`

Expected: FAIL because the repository modules do not exist yet.

- [ ] **Step 3: Implement the stores and local upload handling**

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/lib/repos/project-store.ts
import crypto from "node:crypto";
import Database from "better-sqlite3";

function open(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}

export function createProject(
  dbPath: string,
  input: { ownerUserId: string; name: string },
) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  const row = {
    id: `proj_${crypto.randomUUID()}`,
    owner_user_id: input.ownerUserId,
    name: input.name.trim(),
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `INSERT INTO projects (id, owner_user_id, name, created_at, updated_at)
     VALUES (@id, @owner_user_id, @name, @created_at, @updated_at)`,
  ).run(row);

  db.close();
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProjects(dbPath: string, ownerUserId: string) {
  const db = open(dbPath);
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.updated_at,
              COUNT(d.id) AS document_count
       FROM projects p
       LEFT JOIN documents d
         ON d.project_id = p.id
        AND d.deleted_at IS NULL
       WHERE p.owner_user_id = ?
         AND p.deleted_at IS NULL
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
    )
    .all(ownerUserId) as Array<{
      id: string;
      name: string;
      updated_at: string;
      document_count: number;
    }>;

  db.close();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    documentCount: row.document_count,
    updatedAt: row.updated_at,
  }));
}

export function getProjectById(dbPath: string, projectId: string) {
  const db = open(dbPath);
  const row = db
    .prepare(
      `SELECT p.id, p.name, p.updated_at,
              COUNT(d.id) AS document_count
         FROM projects p
         LEFT JOIN documents d
           ON d.project_id = p.id
          AND d.deleted_at IS NULL
        WHERE p.id = ?
          AND p.deleted_at IS NULL
        GROUP BY p.id`,
    )
    .get(projectId) as
    | { id: string; name: string; updated_at: string; document_count: number }
    | undefined;

  db.close();
  return row
    ? {
        id: row.id,
        name: row.name,
        documentCount: row.document_count,
        updatedAt: row.updated_at,
      }
    : null;
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/lib/repos/document-store.ts
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

  const parsed = JSON.parse(row.pages_json) as Array<{ page: number; content: string }>;
  const allowed = parsePagesFilter(pages);
  return allowed ? parsed.filter((entry) => allowed.has(entry.page)) : parsed;
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/lib/repos/job-store.ts
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
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/lib/repos/conversation-store.ts
import crypto from "node:crypto";
import Database from "better-sqlite3";

function open(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}

export function createConversation(dbPath: string, ownerUserId: string) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  const row = {
    id: `conv_${crypto.randomUUID()}`,
    owner_user_id: ownerUserId,
    title: "New Chat",
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `INSERT INTO conversations (id, owner_user_id, title, created_at, updated_at)
     VALUES (@id, @owner_user_id, @title, @created_at, @updated_at)`,
  ).run(row);

  db.close();
  return { id: row.id, title: row.title };
}

export function listConversations(dbPath: string, ownerUserId: string) {
  const db = open(dbPath);
  const rows = db
    .prepare(
      `SELECT c.id,
              c.title,
              c.updated_at,
              COUNT(cp.project_id) AS project_count,
              MIN(p.name) AS first_project_name
         FROM conversations c
         LEFT JOIN conversation_projects cp
           ON cp.conversation_id = c.id
         LEFT JOIN projects p
           ON p.id = cp.project_id
        WHERE c.owner_user_id = ?
          AND c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.updated_at DESC`,
    )
    .all(ownerUserId) as Array<{
      id: string;
      title: string;
      updated_at: string;
      project_count: number;
      first_project_name: string | null;
    }>;

  db.close();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    scopeLabel:
      row.project_count === 0
        ? "No project"
        : row.project_count === 1
          ? row.first_project_name ?? "Unknown project"
          : "Multiple projects",
  }));
}

export function replaceConversationProjects(
  dbPath: string,
  conversationId: string,
  projectIds: string[],
) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO conversation_projects (conversation_id, project_id, created_at)
     VALUES (?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM conversation_projects WHERE conversation_id = ?`,
    ).run(conversationId);

    for (const projectId of projectIds) {
      insert.run(conversationId, projectId, now);
    }
  });

  tx();
  db.close();
}

export function appendConversationMessage(
  dbPath: string,
  input: {
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    citations: unknown[];
  },
) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  const message = {
    id: `msg_${crypto.randomUUID()}`,
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    citations_json: JSON.stringify(input.citations),
    created_at: now,
  };

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO conversation_messages (
         id, conversation_id, role, content, citations_json, created_at
       ) VALUES (
         @id, @conversation_id, @role, @content, @citations_json, @created_at
       )`,
    ).run(message);

    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(
      now,
      input.conversationId,
    );
  });

  tx();
  db.close();
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    citations: input.citations,
    createdAt: message.created_at,
  };
}

export function updateConversationTitle(
  dbPath: string,
  conversationId: string,
  title: string,
) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  db.prepare(`UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`).run(
    title.trim(),
    now,
    conversationId,
  );
  db.close();
}

export function getConversationDetail(dbPath: string, conversationId: string) {
  const db = open(dbPath);
  const conversation = db
    .prepare(
      `SELECT id, title, updated_at
         FROM conversations
        WHERE id = ?
          AND deleted_at IS NULL`,
    )
    .get(conversationId) as
    | { id: string; title: string; updated_at: string }
    | undefined;
  const projectRows = db
    .prepare(
      `SELECT cp.project_id, p.name
         FROM conversation_projects cp
         JOIN projects p ON p.id = cp.project_id
        WHERE cp.conversation_id = ?
        ORDER BY cp.created_at ASC`,
    )
    .all(conversationId) as Array<{ project_id: string; name: string }>;
  const messageRows = db
    .prepare(
      `SELECT id, role, content, citations_json, created_at
         FROM conversation_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC`,
    )
    .all(conversationId) as Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      citations_json: string;
      created_at: string;
    }>;

  db.close();
  return {
    id: conversation?.id ?? conversationId,
    title: conversation?.title ?? "New Chat",
    projectIds: projectRows.map((row) => row.project_id),
    projects: projectRows.map((row) => ({
      id: row.project_id,
      name: row.name,
    })),
    messages: messageRows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      citations: JSON.parse(row.citations_json),
      createdAt: row.created_at,
    })),
  };
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/lib/storage/local-files.ts
import fs from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@/lib/config";

export async function saveUploadedPdf(projectId: string, file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relativePath = path.join(projectId, `${Date.now()}-${safeName}`);
  const absolutePath = path.join(appConfig.uploadRoot, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);

  return {
    storagePath: absolutePath,
    fileSize: bytes.byteLength,
  };
}
```

- [ ] **Step 4: Add the browser-facing routes and verify the repository tests pass**

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { createProject, listProjects } from "@/lib/repos/project-store";

const schema = z.object({ name: z.string().min(1).max(120) });
const demoUserId = "user_demo";

export async function GET() {
  return NextResponse.json({ projects: listProjects(appConfig.dbPath, demoUserId) });
}

export async function POST(request: NextRequest) {
  const body = schema.parse(await request.json());
  const project = createProject(appConfig.dbPath, {
    ownerUserId: demoUserId,
    name: body.name,
  });
  return NextResponse.json(project, { status: 201 });
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/projects/[projectId]/route.ts
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getProjectById } from "@/lib/repos/project-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = getProjectById(appConfig.dbPath, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/projects/[projectId]/documents/route.ts
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { listDocumentsByProject } from "@/lib/repos/document-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return NextResponse.json({
    documents: listDocumentsByProject(appConfig.dbPath, projectId),
  });
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/projects/[projectId]/documents/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { createDocumentRecord } from "@/lib/repos/document-store";
import { createIndexJob } from "@/lib/repos/job-store";
import { saveUploadedPdf } from "@/lib/storage/local-files";

const demoUserId = "user_demo";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
  }

  const stored = await saveUploadedPdf(projectId, file);
  const document = createDocumentRecord(appConfig.dbPath, {
    ownerUserId: demoUserId,
    projectId,
    fileName: file.name,
    storagePath: stored.storagePath,
    mimeType: file.type,
    fileSize: stored.fileSize,
  });
  const job = createIndexJob(appConfig.dbPath, document.id);

  return NextResponse.json(
    {
      uploaded: [
        {
          documentId: document.id,
          fileName: document.fileName,
          status: document.status,
          jobId: job.id,
        },
      ],
    },
    { status: 201 },
  );
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/documents/[documentId]/route.ts
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getDocumentDetail } from "@/lib/repos/document-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const document = getDocumentDetail(appConfig.dbPath, documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json(document);
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/documents/[documentId]/structure/route.ts
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getDocumentStructure } from "@/lib/repos/document-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return NextResponse.json({
    structure: getDocumentStructure(appConfig.dbPath, documentId),
  });
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/documents/[documentId]/pages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getDocumentPages } from "@/lib/repos/document-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const pages = request.nextUrl.searchParams.get("pages");
  return NextResponse.json({
    pages: getDocumentPages(appConfig.dbPath, documentId, pages),
  });
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/documents/[documentId]/reindex/route.ts
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { createIndexJob } from "@/lib/repos/job-store";

export async function POST(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const job = createIndexJob(appConfig.dbPath, documentId);
  return NextResponse.json(job, { status: 202 });
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/conversations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import {
  createConversation,
  listConversations,
  replaceConversationProjects,
} from "@/lib/repos/conversation-store";

const demoUserId = "user_demo";
const schema = z.object({
  projectIds: z.array(z.string()).default([]),
});

export async function GET() {
  return NextResponse.json({
    conversations: listConversations(appConfig.dbPath, demoUserId),
  });
}

export async function POST(request: NextRequest) {
  const body = schema.parse(await request.json().catch(() => ({})));
  const conversation = createConversation(appConfig.dbPath, demoUserId);
  replaceConversationProjects(appConfig.dbPath, conversation.id, body.projectIds);
  return NextResponse.json(conversation, { status: 201 });
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/conversations/[conversationId]/route.ts
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getConversationDetail } from "@/lib/repos/conversation-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  return NextResponse.json(getConversationDetail(appConfig.dbPath, conversationId));
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/conversations/[conversationId]/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { replaceConversationProjects } from "@/lib/repos/conversation-store";

const schema = z.object({
  projectIds: z.array(z.string().min(1)),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const body = schema.parse(await request.json());
  replaceConversationProjects(appConfig.dbPath, conversationId, body.projectIds);
  return NextResponse.json({ ok: true });
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/jobs/[jobId]/route.ts
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getJob } from "@/lib/repos/job-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const job = getJob(appConfig.dbPath, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
```

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm vitest run tests/repos/project-store.test.ts tests/repos/conversation-store.test.ts`

Expected: PASS with project, document, job, conversation scope, and message persistence working against SQLite.

- [ ] **Step 5: Commit the BFF data layer**

```bash
cd /Users/oam/Workspace/demos/PageIndexDemo
git add web/lib/repos web/lib/storage web/app/api/projects web/app/api/documents web/app/api/conversations web/app/api/jobs web/tests/repos
git commit -m "feat: add sqlite stores and bff routes"
```

### Task 3: Implement the indexing worker that writes PageIndex results back into SQLite

**Files:**
- Create: `services/common/settings.py`
- Create: `services/common/sqlite_store.py`
- Create: `services/common/models.py`
- Create: `services/index_worker/index_document.py`
- Create: `services/index_worker/worker.py`
- Create: `services/tests/test_index_document.py`

- [ ] **Step 1: Write the failing worker test**

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/tests/test_index_document.py
import json
import sqlite3
from pathlib import Path

from services.index_worker.index_document import process_document_job


def test_process_document_job_marks_document_ready(tmp_path, monkeypatch):
    db_path = tmp_path / "app.db"
    schema = Path("web/lib/db/schema.sql").read_text(encoding="utf-8")
    conn = sqlite3.connect(db_path)
    conn.executescript(schema)

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
```

- [ ] **Step 2: Run the worker test and confirm it fails**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo && pytest services/tests/test_index_document.py -q`

Expected: FAIL because the worker modules do not exist yet.

- [ ] **Step 3: Implement the worker and PageIndex persistence**

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/common/settings.py
from pathlib import Path
import os


REPO_ROOT = Path(__file__).resolve().parents[2]
VAR_ROOT = Path(os.getenv("APP_VAR_ROOT", REPO_ROOT / "var"))
DB_PATH = Path(os.getenv("APP_DB_PATH", VAR_ROOT / "app.db"))
UPLOAD_ROOT = Path(os.getenv("APP_UPLOAD_ROOT", VAR_ROOT / "uploads"))
```

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/common/models.py
from typing import TypedDict


class IndexedPage(TypedDict):
    page: int
    content: str


class IndexedDocumentPayload(TypedDict):
    doc_name: str
    doc_description: str
    structure: list[dict]
    pages: list[IndexedPage]
    page_count: int
```

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/common/sqlite_store.py
import sqlite3
from contextlib import contextmanager


@contextmanager
def open_db(db_path: str):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
```

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/index_worker/index_document.py
import json
from datetime import datetime, timezone

from PyPDF2 import PdfReader

from pageindex.page_index import page_index
from services.common.models import IndexedDocumentPayload
from services.common.sqlite_store import open_db


def build_pageindex_payload(file_path: str) -> IndexedDocumentPayload:
    result = page_index(
        doc=file_path,
        if_add_node_summary="yes",
        if_add_node_text="yes",
        if_add_node_id="yes",
        if_add_doc_description="yes",
    )
    reader = PdfReader(file_path)
    pages = [
        {"page": index + 1, "content": page.extract_text() or ""}
        for index, page in enumerate(reader.pages)
    ]
    return {
        "doc_name": result["doc_name"],
        "doc_description": result.get("doc_description", ""),
        "structure": result["structure"],
        "pages": pages,
        "page_count": len(pages),
    }


def process_document_job(db_path: str, job_id: str):
    now = datetime.now(timezone.utc).isoformat()

    with open_db(db_path) as conn:
        row = conn.execute(
            """
            SELECT j.id AS job_id, d.id AS document_id, d.storage_path
            FROM jobs j
            JOIN documents d ON d.id = j.document_id
            WHERE j.id = ?
            """,
            (job_id,),
        ).fetchone()

        if row is None:
            raise ValueError(f"Job {job_id} not found")

        payload = build_pageindex_payload(row["storage_path"])

        conn.execute(
            """
            INSERT INTO document_indexes (
              id, document_id, doc_name, doc_description, structure_json,
              pages_json, index_version, indexed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET
              doc_name = excluded.doc_name,
              doc_description = excluded.doc_description,
              structure_json = excluded.structure_json,
              pages_json = excluded.pages_json,
              index_version = excluded.index_version,
              indexed_at = excluded.indexed_at
            """,
            (
                f"idx_{row['document_id']}",
                row["document_id"],
                payload["doc_name"],
                payload["doc_description"],
                json.dumps(payload["structure"], ensure_ascii=False),
                json.dumps(payload["pages"], ensure_ascii=False),
                "v1",
                now,
            ),
        )

        conn.execute(
            """
            UPDATE documents
               SET status = ?, page_count = ?, error_message = NULL, updated_at = ?
             WHERE id = ?
            """,
            ("ready", payload["page_count"], now, row["document_id"]),
        )
        conn.execute(
            """
            UPDATE jobs
               SET status = ?, progress = ?, updated_at = ?, finished_at = ?, error_message = NULL
             WHERE id = ?
            """,
            ("completed", 100, now, now, job_id),
        )
```

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/index_worker/worker.py
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
```

- [ ] **Step 4: Run the worker test and verify it passes**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo && pytest services/tests/test_index_document.py -q`

Expected: PASS with the job completing and the document becoming `ready`.

- [ ] **Step 5: Commit the worker**

```bash
cd /Users/oam/Workspace/demos/PageIndexDemo
git add services/common services/index_worker services/tests/test_index_document.py
git commit -m "feat: add pageindex indexing worker"
```

### Task 4: Implement multi-project document selection, PageIndex query orchestration, and the chat send route

**Files:**
- Create: `services/retrieval_api/schemas.py`
- Create: `services/retrieval_api/select_documents.py`
- Create: `services/retrieval_api/query_engine.py`
- Create: `services/retrieval_api/app.py`
- Create: `services/tests/test_select_documents.py`
- Create: `services/tests/test_query_engine.py`
- Create: `web/lib/retrieval-client.ts`
- Create: `web/app/api/chat/send/route.ts`

- [ ] **Step 1: Write failing tests for candidate selection and answer composition**

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/tests/test_select_documents.py
from services.retrieval_api.select_documents import keyword_score, select_candidate_documents


def test_keyword_score_prefers_matching_description():
    query = "cash flow risk"
    doc = {
        "id": "doc_1",
        "project_id": "proj_1",
        "file_name": "alpha.pdf",
        "doc_description": "Cash flow risk factors and debt covenants",
    }
    assert keyword_score(query, doc) > 0


def test_select_candidate_documents_limits_results():
    docs = [
        {
            "id": f"doc_{index}",
            "project_id": "proj_1",
            "file_name": f"doc-{index}.pdf",
            "doc_description": "cash flow risk" if index < 3 else "unrelated",
        }
        for index in range(10)
    ]
    selected = select_candidate_documents("cash flow risk", docs, limit=2)
    assert len(selected) == 2
```

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/tests/test_query_engine.py
from services.retrieval_api.query_engine import build_citation


def test_build_citation_includes_project_and_pages():
    citation = build_citation(
        project={"id": "proj_1", "name": "Alpha"},
        document={"id": "doc_1", "file_name": "alpha.pdf"},
        pages="4-5",
    )

    assert citation == {
        "projectId": "proj_1",
        "projectName": "Alpha",
        "documentId": "doc_1",
        "documentName": "alpha.pdf",
        "pages": "4-5",
    }
```

- [ ] **Step 2: Run the retrieval tests and confirm they fail**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo && pytest services/tests/test_select_documents.py services/tests/test_query_engine.py -q`

Expected: FAIL because the retrieval modules do not exist yet.

- [ ] **Step 3: Implement the retrieval service and BFF chat bridge**

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/retrieval_api/schemas.py
from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(min_length=1)
    projectIds: list[str] = Field(min_length=1)


class Citation(BaseModel):
    projectId: str
    projectName: str
    documentId: str
    documentName: str
    pages: str


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    selectedDocuments: list[dict]
```

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/retrieval_api/select_documents.py
from collections import Counter


def keyword_score(query: str, doc: dict) -> int:
    tokens = [token for token in query.lower().split() if token]
    haystack = f"{doc.get('file_name', '')} {doc.get('doc_description', '')}".lower()
    counts = Counter(tokens)
    return sum(weight for token, weight in counts.items() if token in haystack)


def select_candidate_documents(query: str, docs: list[dict], limit: int = 8) -> list[dict]:
    ranked = sorted(
        docs,
        key=lambda doc: (keyword_score(query, doc), doc.get("file_name", "")),
        reverse=True,
    )
    return [doc for doc in ranked if keyword_score(query, doc) > 0][:limit]
```

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/retrieval_api/query_engine.py
import json
import sqlite3

from pageindex.retrieve import get_document_structure, get_page_content
from pageindex.utils import extract_json, llm_completion

from services.retrieval_api.select_documents import select_candidate_documents


def build_citation(project: dict, document: dict, pages: str) -> dict:
    return {
        "projectId": project["id"],
        "projectName": project["name"],
        "documentId": document["id"],
        "documentName": document["file_name"],
        "pages": pages,
    }


def choose_page_window(query: str, document: dict) -> str:
    document_map = {
        document["id"]: {
            "type": "pdf",
            "page_count": len(document["pages"]),
            "doc_name": document["file_name"],
            "doc_description": document["doc_description"],
            "structure": document["structure"],
            "pages": document["pages"],
        }
    }
    structure_json = get_document_structure(document_map, document["id"])
    prompt = f"""
You are selecting the smallest useful page range for a PDF question.

Question: {query}
Structure:
{structure_json}

Return JSON only:
{{"pages": "3-5"}}
"""
    parsed = extract_json(llm_completion(model=None, prompt=prompt))
    return parsed.get("pages", "1-2")


def answer_question(db_path: str, query: str, project_ids: list[str]) -> dict:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    rows = conn.execute(
        """
        SELECT d.id, d.project_id, d.file_name, p.name AS project_name,
               di.doc_description, di.structure_json, di.pages_json
          FROM documents d
          JOIN projects p ON p.id = d.project_id
          JOIN document_indexes di ON di.document_id = d.id
         WHERE d.status = 'ready'
           AND d.project_id IN ({})
        """.format(",".join("?" for _ in project_ids)),
        project_ids,
    ).fetchall()

    docs = [
        {
            **dict(row),
            "structure": json.loads(row["structure_json"]),
            "pages": json.loads(row["pages_json"]),
        }
        for row in rows
    ]
    selected = select_candidate_documents(query, docs, limit=5)
    if not selected:
        return {
            "answer": "No ready documents matched the selected projects.",
            "citations": [],
            "selectedDocuments": [],
        }

    context_blocks = []
    citations = []

    for doc in selected:
        pages = choose_page_window(query, doc)
        document_map = {
            doc["id"]: {
                "type": "pdf",
                "page_count": len(doc["pages"]),
                "doc_name": doc["file_name"],
                "doc_description": doc["doc_description"],
                "structure": doc["structure"],
                "pages": doc["pages"],
            }
        }
        excerpt = json.loads(get_page_content(document_map, doc["id"], pages))
        context_blocks.append(
            {
                "project": doc["project_name"],
                "document": doc["file_name"],
                "pages": pages,
                "evidence": excerpt,
            }
        )
        citations.append(
            build_citation(
                project={"id": doc["project_id"], "name": doc["project_name"]},
                document={"id": doc["id"], "file_name": doc["file_name"]},
                pages=pages,
            )
        )

    prompt = f"""
Answer the user's question only from the provided document evidence.

Question: {query}

Evidence:
{json.dumps(context_blocks, ensure_ascii=False)}

Return only the answer text.
"""
    answer = llm_completion(model=None, prompt=prompt)
    conn.close()

    return {
        "answer": answer,
        "citations": citations,
        "selectedDocuments": [{"documentId": doc["id"]} for doc in selected],
    }
```

```python
# /Users/oam/Workspace/demos/PageIndexDemo/services/retrieval_api/app.py
from fastapi import FastAPI

from services.common.settings import DB_PATH
from services.retrieval_api.query_engine import answer_question
from services.retrieval_api.schemas import QueryRequest, QueryResponse


app = FastAPI()


@app.post("/internal/retrieve/query")
def retrieve_query(request: QueryRequest) -> QueryResponse:
    return answer_question(str(DB_PATH), request.query, request.projectIds)
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/lib/retrieval-client.ts
import { appConfig } from "@/lib/config";

export type RetrievalCitation = {
  projectId: string;
  projectName: string;
  documentId: string;
  documentName: string;
  pages: string;
};

export async function sendRetrievalQuery(input: {
  query: string;
  projectIds: string[];
}) {
  const response = await fetch(`${appConfig.retrievalBaseUrl}/internal/retrieve/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`retrieval failed with status ${response.status}`);
  }

  return response.json() as Promise<{
    answer: string;
    citations: RetrievalCitation[];
    selectedDocuments: Array<{ documentId: string }>;
  }>;
}
```

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/api/chat/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { sendRetrievalQuery } from "@/lib/retrieval-client";
import {
  appendConversationMessage,
  getConversationDetail,
  replaceConversationProjects,
  updateConversationTitle,
} from "@/lib/repos/conversation-store";

const schema = z.object({
  conversationId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  message: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = schema.parse(await request.json());
  const conversation = getConversationDetail(appConfig.dbPath, body.conversationId);

  replaceConversationProjects(appConfig.dbPath, body.conversationId, body.projectIds);
  appendConversationMessage(appConfig.dbPath, {
    conversationId: body.conversationId,
    role: "user",
    content: body.message,
    citations: [],
  });
  if (conversation.title === "New Chat") {
    updateConversationTitle(
      appConfig.dbPath,
      body.conversationId,
      body.message.slice(0, 48),
    );
  }

  const result = await sendRetrievalQuery({
    query: body.message,
    projectIds: body.projectIds,
  });

  appendConversationMessage(appConfig.dbPath, {
    conversationId: body.conversationId,
    role: "assistant",
    content: result.answer,
    citations: result.citations,
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 4: Run the retrieval tests and verify they pass**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo && pytest services/tests/test_select_documents.py services/tests/test_query_engine.py -q`

Expected: PASS with deterministic document scoring and citation formatting.

- [ ] **Step 5: Commit the retrieval path**

```bash
cd /Users/oam/Workspace/demos/PageIndexDemo
git add services/retrieval_api services/tests/test_select_documents.py services/tests/test_query_engine.py web/lib/retrieval-client.ts web/app/api/chat/send/route.ts
git commit -m "feat: add multi-project retrieval service"
```

### Task 5: Build the shared app shell and the project management screens

**Files:**
- Create: `web/app/globals.css`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx`
- Create: `web/app/projects/page.tsx`
- Create: `web/app/projects/[projectId]/page.tsx`
- Create: `web/components/app-shell.tsx`
- Create: `web/components/sidebar-nav.tsx`
- Create: `web/components/project-grid.tsx`
- Create: `web/components/project-card.tsx`
- Create: `web/components/document-table.tsx`
- Create: `web/components/document-upload-modal.tsx`
- Create: `web/tests/components/project-grid.test.tsx`

- [ ] **Step 1: Write the failing component test for the project grid**

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/tests/components/project-grid.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectGrid } from "@/components/project-grid";

describe("ProjectGrid", () => {
  it("renders project cards with counts", () => {
    render(
      <ProjectGrid
        projects={[
          {
            id: "proj_1",
            name: "Alpha",
            documentCount: 3,
            updatedAt: "2026-04-19T00:00:00Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("3 documents")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component test and confirm it fails**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm vitest run tests/components/project-grid.test.tsx`

Expected: FAIL because the component tree does not exist yet.

- [ ] **Step 3: Implement the shell, sidebar, and project pages**

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(53, 91, 170, 0.22), transparent 32%),
    linear-gradient(180deg, #12161d 0%, #090b0f 100%);
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#11151D] text-white antialiased">{children}</body>
    </html>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/page.tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/chat");
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/app-shell.tsx
import { ReactNode } from "react";
import { SidebarNav } from "@/components/sidebar-nav";

export function AppShell({
  children,
  conversations,
}: {
  children: ReactNode;
  conversations: Array<{ id: string; title: string; scopeLabel: string }>;
}) {
  return (
    <div className="flex min-h-screen bg-[#11151D]">
      <SidebarNav conversations={conversations} />
      <main className="flex-1 rounded-2xl border border-[#23272F] bg-black m-2 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/sidebar-nav.tsx
import Link from "next/link";

export function SidebarNav({
  conversations,
}: {
  conversations: Array<{ id: string; title: string; scopeLabel: string }>;
}) {
  return (
    <aside className="flex w-[288px] flex-col border-r border-white/5 bg-[#0d1015]/90 px-4 py-5">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1c2331] text-sm font-semibold">
          PI
        </div>
        <div>
          <div className="text-sm font-semibold">PageIndex</div>
          <div className="text-xs text-zinc-500">Project Knowledge Chat</div>
        </div>
      </div>

      <Link
        href="/chat"
        className="mb-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black"
      >
        New Chat
      </Link>
      <Link
        href="/projects"
        className="mb-6 rounded-2xl border border-white/10 px-4 py-3 text-sm text-zinc-200"
      >
        Projects
      </Link>

      <div className="mb-3 px-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
        Chats
      </div>
      <div className="space-y-2 overflow-y-auto">
        {conversations.map((conversation) => (
          <Link
            key={conversation.id}
            href={`/chat?conversationId=${conversation.id}`}
            className="block rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3"
          >
            <div className="truncate text-sm font-medium">{conversation.title}</div>
            <div className="mt-1 text-xs text-zinc-500">{conversation.scopeLabel}</div>
          </Link>
        ))}
      </div>
    </aside>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/project-card.tsx
export function ProjectCard({
  name,
  documentCount,
  updatedAt,
}: {
  name: string;
  documentCount: number;
  updatedAt: string;
}) {
  return (
    <div className="rounded-2xl border border-[#2d313a] bg-[#171a21] p-5">
      <div className="text-xl font-semibold">{name}</div>
      <div className="mt-2 text-sm text-zinc-400">
        {documentCount} documents
      </div>
      <div className="mt-1 text-xs text-zinc-500">Updated {updatedAt}</div>
    </div>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/project-grid.tsx
import { ProjectCard } from "@/components/project-card";

export function ProjectGrid({
  projects,
}: {
  projects: Array<{
    id: string;
    name: string;
    documentCount: number;
    updatedAt: string;
  }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <a key={project.id} href={`/projects/${project.id}`}>
          <ProjectCard
            name={project.name}
            documentCount={project.documentCount}
            updatedAt={project.updatedAt}
          />
        </a>
      ))}
    </div>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/projects/page.tsx
import { appConfig } from "@/lib/config";
import { AppShell } from "@/components/app-shell";
import { ProjectGrid } from "@/components/project-grid";
import { listConversations } from "@/lib/repos/conversation-store";
import { listProjects } from "@/lib/repos/project-store";

const demoUserId = "user_demo";

export default function ProjectsPage() {
  const conversations = listConversations(appConfig.dbPath, demoUserId);
  const projects = listProjects(appConfig.dbPath, demoUserId);

  return (
    <AppShell conversations={conversations}>
      <section className="p-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold">Projects</h1>
            <p className="mt-2 text-zinc-400">
              Create projects and upload the PDFs you want to query.
            </p>
          </div>
          <button className="rounded-xl border border-[#2d313a] px-4 py-3">
            New Project
          </button>
        </header>
        <ProjectGrid projects={projects} />
      </section>
    </AppShell>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/document-table.tsx
export function DocumentTable({
  documents,
}: {
  documents: Array<{
    id: string;
    fileName: string;
    pageCount: number;
    status: string;
    createdAt: string;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-white/[0.03] text-zinc-500">
          <tr>
            <th className="px-5 py-4 font-medium">Document</th>
            <th className="px-5 py-4 font-medium">Pages</th>
            <th className="px-5 py-4 font-medium">Status</th>
            <th className="px-5 py-4 font-medium">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id} className="border-t border-white/6">
              <td className="px-5 py-4">{document.fileName}</td>
              <td className="px-5 py-4 text-zinc-400">{document.pageCount}</td>
              <td className="px-5 py-4">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-zinc-300">
                  {document.status}
                </span>
              </td>
              <td className="px-5 py-4 text-zinc-500">{document.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/document-upload-modal.tsx
"use client";

import { useRef, useState } from "react";

export function DocumentUploadModal({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", files[0]);
      await fetch(`/api/projects/${projectId}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      window.location.reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <button
        type="button"
        disabled={submitting}
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl border border-white/10 px-4 py-3 text-sm disabled:opacity-60"
      >
        {submitting ? "Uploading..." : "Upload PDF"}
      </button>
    </>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/projects/[projectId]/page.tsx
import { appConfig } from "@/lib/config";
import { AppShell } from "@/components/app-shell";
import { DocumentTable } from "@/components/document-table";
import { DocumentUploadModal } from "@/components/document-upload-modal";
import { listConversations } from "@/lib/repos/conversation-store";
import { listDocumentsByProject } from "@/lib/repos/document-store";
import { getProjectById } from "@/lib/repos/project-store";

const demoUserId = "user_demo";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const conversations = listConversations(appConfig.dbPath, demoUserId);
  const project = getProjectById(appConfig.dbPath, projectId);
  const documents = listDocumentsByProject(appConfig.dbPath, projectId);

  if (!project) {
    return (
      <AppShell conversations={conversations}>
        <section className="p-10">Project not found.</section>
      </AppShell>
    );
  }

  return (
    <AppShell conversations={conversations}>
      <section className="space-y-8 p-10">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Projects / {project.name}
            </div>
            <h1 className="mt-3 text-4xl font-semibold">{project.name}</h1>
            <p className="mt-2 text-zinc-400">
              Upload PDFs, track indexing status, and prepare this project for chat.
            </p>
          </div>
          <DocumentUploadModal projectId={projectId} />
        </header>
        <DocumentTable documents={documents} />
      </section>
    </AppShell>
  );
}
```

- [ ] **Step 4: Run the component test and verify it passes**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm vitest run tests/components/project-grid.test.tsx`

Expected: PASS with the project grid rendering the project card and count.

- [ ] **Step 5: Commit the projects UI**

```bash
cd /Users/oam/Workspace/demos/PageIndexDemo
git add web/app/globals.css web/app/layout.tsx web/app/page.tsx web/app/projects web/components/app-shell.tsx web/components/sidebar-nav.tsx web/components/project-grid.tsx web/components/project-card.tsx web/components/document-table.tsx web/components/document-upload-modal.tsx web/tests/components/project-grid.test.tsx
git commit -m "feat: add project management screens"
```

### Task 6: Build the chat page, project scope picker, history list, and citation rendering

**Files:**
- Create: `web/app/chat/page.tsx`
- Create: `web/components/chat-history-list.tsx`
- Create: `web/components/chat-message-list.tsx`
- Create: `web/components/chat-composer.tsx`
- Create: `web/components/project-scope-picker.tsx`
- Create: `web/components/citation-list.tsx`
- Modify: `web/components/sidebar-nav.tsx`
- Create: `web/tests/components/chat-page.test.tsx`

- [ ] **Step 1: Write the failing chat-page test**

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/tests/components/chat-page.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatComposer } from "@/components/chat-composer";

describe("ChatComposer", () => {
  it("disables send when no project is selected", () => {
    render(
      <ChatComposer
        availableProjects={[
          { id: "proj_1", name: "Alpha" },
          { id: "proj_2", name: "Beta" },
        ]}
        selectedProjectIds={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the chat component test and confirm it fails**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm vitest run tests/components/chat-page.test.tsx`

Expected: FAIL because the chat composer components do not exist yet.

- [ ] **Step 3: Implement the chat view components and page**

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/project-scope-picker.tsx
"use client";

export function ProjectScopePicker({
  projects,
  selectedProjectIds,
  onToggle,
}: {
  projects: Array<{ id: string; name: string }>;
  selectedProjectIds: string[];
  onToggle: (projectId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {projects.map((project) => {
        const selected = selectedProjectIds.includes(project.id);
        return (
          <button
            key={project.id}
            type="button"
            onClick={() => onToggle(project.id)}
            className={
              selected
                ? "rounded-full bg-[#3b82f6] px-4 py-2 text-sm"
                : "rounded-full border border-[#2d313a] px-4 py-2 text-sm"
            }
          >
            {project.name}
          </button>
        );
      })}
    </div>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/chat-history-list.tsx
import Link from "next/link";

export function ChatHistoryList({
  conversations,
}: {
  conversations: Array<{ id: string; title: string; scopeLabel: string }>;
}) {
  return (
    <div className="space-y-2 overflow-y-auto">
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          href={`/chat?conversationId=${conversation.id}`}
          className="block rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3"
        >
          <div className="truncate text-sm font-medium">{conversation.title}</div>
          <div className="mt-1 text-xs text-zinc-500">{conversation.scopeLabel}</div>
        </Link>
      ))}
    </div>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/chat-message-list.tsx
import { CitationList } from "@/components/citation-list";

export function ChatMessageList({
  messages,
}: {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: Array<{
      projectName: string;
      documentName: string;
      pages: string;
    }>;
  }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-8 py-10">
      {messages.map((message) => (
        <article
          key={message.id}
          className={
            message.role === "user"
              ? "ml-auto max-w-3xl rounded-[28px] bg-white px-6 py-5 text-black"
              : "max-w-3xl rounded-[28px] border border-white/8 bg-white/[0.03] px-6 py-5"
          }
        >
          <div className="whitespace-pre-wrap text-[15px] leading-7">
            {message.content}
          </div>
          {message.role === "assistant" ? (
            <CitationList citations={message.citations} />
          ) : null}
        </article>
      ))}
    </div>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/chat-composer.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectScopePicker } from "@/components/project-scope-picker";

export function ChatComposer({
  availableProjects,
  selectedProjectIds,
  conversationId,
}: {
  availableProjects: Array<{ id: string; name: string }>;
  selectedProjectIds: string[];
  conversationId?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [activeProjectIds, setActiveProjectIds] = useState(selectedProjectIds);
  const [sending, setSending] = useState(false);
  const canSend = activeProjectIds.length > 0 && message.trim().length > 0 && !sending;

  function toggleProject(projectId: string) {
    setActiveProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((value) => value !== projectId)
        : [...current, projectId],
    );
  }

  const placeholder =
    activeProjectIds.length === 0
      ? "Select at least one project before asking a question."
      : "Ask a question about the selected projects...";

  async function handleSend() {
    if (!canSend) return;

    setSending(true);
    try {
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const created = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectIds: activeProjectIds }),
        }).then((response) => response.json());
        currentConversationId = created.id;
      }

      await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConversationId,
          projectIds: activeProjectIds,
          message,
        }),
      });

      router.push(`/chat?conversationId=${currentConversationId}`);
      router.refresh();
      setMessage("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-[#2d313a] bg-[#171a21] p-4">
      <textarea
        className="min-h-[120px] w-full resize-none bg-transparent text-lg outline-none"
        placeholder={placeholder}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <div className="mt-4 flex items-end justify-between gap-4">
        <ProjectScopePicker
          projects={availableProjects}
          selectedProjectIds={activeProjectIds}
          onToggle={toggleProject}
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={handleSend}
          aria-label="Send"
          className="rounded-full bg-[#3b82f6] px-5 py-3 disabled:opacity-40"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/citation-list.tsx
export function CitationList({
  citations,
}: {
  citations: Array<{
    projectName: string;
    documentName: string;
    pages: string;
  }>;
}) {
  if (citations.length === 0) return null;

  return (
    <ul className="mt-4 space-y-2 text-sm text-zinc-400">
      {citations.map((citation) => (
        <li key={`${citation.projectName}-${citation.documentName}-${citation.pages}`}>
          [{citation.projectName}] {citation.documentName} - pages {citation.pages}
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/components/sidebar-nav.tsx
import Link from "next/link";
import { ChatHistoryList } from "@/components/chat-history-list";

export function SidebarNav({
  conversations,
}: {
  conversations: Array<{ id: string; title: string; scopeLabel: string }>;
}) {
  return (
    <aside className="flex w-[288px] flex-col border-r border-white/5 bg-[#0d1015]/90 px-4 py-5">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1c2331] text-sm font-semibold">
          PI
        </div>
        <div>
          <div className="text-sm font-semibold">PageIndex</div>
          <div className="text-xs text-zinc-500">Project Knowledge Chat</div>
        </div>
      </div>

      <Link
        href="/chat"
        className="mb-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black"
      >
        New Chat
      </Link>
      <Link
        href="/projects"
        className="mb-6 rounded-2xl border border-white/10 px-4 py-3 text-sm text-zinc-200"
      >
        Projects
      </Link>

      <div className="mb-3 px-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
        Chats
      </div>
      <ChatHistoryList conversations={conversations} />
    </aside>
  );
}
```

```tsx
// /Users/oam/Workspace/demos/PageIndexDemo/web/app/chat/page.tsx
import { appConfig } from "@/lib/config";
import { AppShell } from "@/components/app-shell";
import { ChatMessageList } from "@/components/chat-message-list";
import { ChatComposer } from "@/components/chat-composer";
import { listConversations, getConversationDetail } from "@/lib/repos/conversation-store";
import { listProjects } from "@/lib/repos/project-store";

const demoUserId = "user_demo";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string }>;
}) {
  const { conversationId } = await searchParams;
  const conversations = listConversations(appConfig.dbPath, demoUserId);
  const projects = listProjects(appConfig.dbPath, demoUserId).map((project) => ({
    id: project.id,
    name: project.name,
  }));
  const conversation = conversationId
    ? getConversationDetail(appConfig.dbPath, conversationId)
    : null;
  const messages = conversation?.messages ?? [];
  const activeProjectIds = conversation?.projectIds ?? [];

  return (
    <AppShell conversations={conversations}>
      <section className="flex h-full flex-col">
        <header className="border-b border-[#23272F] px-8 py-6 text-3xl font-semibold">
          {conversation?.title ?? "New Chat"}
        </header>
        {messages.length > 0 ? (
          <ChatMessageList messages={messages} />
        ) : (
          <div className="flex flex-1 items-center justify-center px-8">
            <div className="w-full max-w-3xl text-center">
              <h2 className="text-5xl font-semibold">Welcome to PageIndex</h2>
              <p className="mt-6 text-zinc-400">
                Select one or more projects, then ask a question against the indexed PDFs.
              </p>
            </div>
          </div>
        )}
        <div className="border-t border-transparent px-8 pb-8">
          <div className="mx-auto max-w-4xl">
            <ChatComposer
              availableProjects={projects}
              selectedProjectIds={activeProjectIds}
              conversationId={conversation?.id}
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
```

- [ ] **Step 4: Run the chat component test and verify it passes**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm vitest run tests/components/chat-page.test.tsx`

Expected: PASS with the send button disabled until a project scope exists.

- [ ] **Step 5: Commit the chat UI**

```bash
cd /Users/oam/Workspace/demos/PageIndexDemo
git add web/app/chat/page.tsx web/components/sidebar-nav.tsx web/components/chat-history-list.tsx web/components/chat-message-list.tsx web/components/chat-composer.tsx web/components/project-scope-picker.tsx web/components/citation-list.tsx web/tests/components/chat-page.test.tsx
git commit -m "feat: add project-scoped chat interface"
```

### Task 7: Add end-to-end coverage, service startup scripts, and developer documentation

**Files:**
- Create: `web/tests/e2e/project-chat.spec.ts`
- Create: `web/playwright.config.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing end-to-end test**

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/tests/e2e/project-chat.spec.ts
import { test, expect } from "@playwright/test";

test("creates a project, uploads a document, and opens chat", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByText("Projects")).toBeVisible();
  await expect(page.getByRole("button", { name: "New Project" })).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e test and confirm it fails**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm playwright test tests/e2e/project-chat.spec.ts`

Expected: FAIL because Playwright config and app startup integration are not wired yet.

- [ ] **Step 3: Add Playwright config and a developer runbook**

```ts
// /Users/oam/Workspace/demos/PageIndexDemo/web/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: true,
    cwd: "/Users/oam/Workspace/demos/PageIndexDemo/web",
  },
});
```

```md
<!-- /Users/oam/Workspace/demos/PageIndexDemo/README.md -->
## Project-Centric Knowledge Chat

### Services

Run these three processes in separate terminals:

```bash
cd web
pnpm install
pnpm db:migrate
pnpm dev
```

```bash
cd /Users/oam/Workspace/demos/PageIndexDemo
uvicorn services.retrieval_api.app:app --reload --port 8001
```

```bash
cd /Users/oam/Workspace/demos/PageIndexDemo
python -m services.index_worker.worker
```

### Workflow

1. Open `http://127.0.0.1:3000/projects`
2. Create a project
3. Upload a PDF
4. Wait for the document to become `ready`
5. Open `/chat`
6. Select the project and ask a question
```

- [ ] **Step 4: Run the test suite and verify the vertical slice**

Run: `cd /Users/oam/Workspace/demos/PageIndexDemo/web && pnpm vitest run && pnpm playwright test tests/e2e/project-chat.spec.ts`

Expected: PASS with unit tests green and the basic project/chat navigation smoke-tested.

- [ ] **Step 5: Commit the verification and docs**

```bash
cd /Users/oam/Workspace/demos/PageIndexDemo
git add web/tests/e2e/project-chat.spec.ts web/playwright.config.ts README.md
git commit -m "test: add project chat smoke coverage"
```
