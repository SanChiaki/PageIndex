# Directory Knowledge Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker-runnable directory knowledge retrieval service that auto-imports project folders, indexes relative paths and image-derived evidence, records parsing time and Token usage, and returns evidence packages for downstream post-processing.

**Architecture:** Extend the existing SQLite-backed project/document model, add a Python directory watcher that feeds the current indexing queue, instrument the Python indexing path for timing and Token metrics, and expose the new metadata through FastAPI and Next.js APIs/UI. Keep the first implementation single-node and local-state based, matching the current demo architecture.

**Tech Stack:** SQLite, Python FastAPI worker modules, PageIndex core, LiteLLM token utilities, PyMuPDF/PyPDF2, Next.js 16, better-sqlite3, Vitest, pytest, Docker Compose.

---

## File Structure

- Modify `web/lib/db/schema.sql`: add source path columns, latest metric columns, index metadata columns, and `document_index_runs`.
- Modify `web/lib/db/migrate.ts`: add idempotent column backfill for existing SQLite DB files.
- Modify `web/lib/repos/document-store.ts`: return path and metric fields, add document run history reader.
- Modify `web/components/document-table.tsx`: show latest parse duration, Token usage, and source-relative path.
- Add `web/app/api/documents/[documentId]/index-runs/route.ts`: return index run history.
- Modify `services/common/settings.py`: add `PROJECTS_ROOT`, `VISION_MODEL`, `VISION_EXTRACTION_ENABLED`, `DIRECTORY_SCAN_INTERVAL_SECONDS`, and `INDEX_DEBUG_METRICS`.
- Add `services/common/index_metrics.py`: track run timings, LLM calls, and Token usage.
- Add `services/common/llm_metrics.py`: context manager that instruments PageIndex LLM calls.
- Add `services/index_worker/vision.py`: convert standalone images and low-text PDF pages into text evidence through a configurable vision model.
- Modify `services/index_worker/index_document.py`: support PDF, Markdown, text, and image payloads; persist index run metrics.
- Add `services/directory_watcher/sync.py`: scan `PROJECTS_ROOT`, upsert projects/documents, queue indexing jobs, and mark deleted files.
- Add `services/directory_watcher/worker.py`: run startup scan plus polling watch loop.
- Modify `services/retrieval_api/schemas.py`: add evidence response fields and a `mode` field that defaults to `answer`.
- Modify `services/retrieval_api/select_documents.py`: include project and relative path fields in candidate selection.
- Modify `services/retrieval_api/query_engine.py`: load relative path/evidence metadata and return evidence-first payloads.
- Add `Dockerfile`, `.dockerignore`, `docker-compose.yml`, and `docker/entrypoints/*.sh`: run web, retrieval API, index worker, and directory watcher.
- Add or modify tests in `services/tests/` and `web/tests/` for schema, watcher, metrics, evidence responses, and UI display.

---

### Task 1: Schema And Repository Metrics

**Files:**
- Modify: `web/lib/db/schema.sql`
- Modify: `web/lib/db/migrate.ts`
- Modify: `web/lib/repos/document-store.ts`
- Test: `web/tests/repos/document-store.test.ts`
- Test: `web/tests/db/migrate.test.ts`

- [ ] **Step 1: Add failing repository tests for source metadata and metrics**

Add tests that create a document with directory metadata, insert an index run, and verify `listDocumentsByProject()` returns display fields:

```ts
expect(row).toMatchObject({
  fileName: "handover.md",
  sourceRelativePath: "ProjectA/delivery/handover.md",
  projectRelativePath: "delivery/handover.md",
  mediaType: "markdown",
  lastIndexDurationMs: 1530,
  lastIndexTotalTokens: 4200,
  lastIndexLlmCallCount: 6,
});
```

Add a migration test that runs `migrateDatabase(dbPath)` twice and verifies `document_index_runs` exists and new columns are present:

```ts
const columns = db.prepare("PRAGMA table_info(documents)").all();
expect(columns.map((column) => column.name)).toContain("source_relative_path");
expect(columns.map((column) => column.name)).toContain("last_index_total_tokens");
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm -C web test -- tests/repos/document-store.test.ts tests/db/migrate.test.ts
```

Expected: fail because the new columns and returned fields do not exist yet.

- [ ] **Step 3: Extend the SQLite schema**

Add nullable source fields to `documents`, nullable metric fields to `documents`, nullable evidence fields to `document_indexes`, and create `document_index_runs`:

```sql
CREATE TABLE IF NOT EXISTS document_index_runs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  job_id TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  text_extraction_ms INTEGER NOT NULL DEFAULT 0,
  pageindex_ms INTEGER NOT NULL DEFAULT 0,
  vision_extraction_ms INTEGER NOT NULL DEFAULT 0,
  persist_ms INTEGER NOT NULL DEFAULT 0,
  llm_call_count INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  token_source TEXT NOT NULL DEFAULT 'estimated',
  models_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  FOREIGN KEY(document_id) REFERENCES documents(id),
  FOREIGN KEY(job_id) REFERENCES jobs(id)
);
```

Add indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_source_relative_path
  ON documents(source_kind, source_relative_path)
  WHERE source_kind = 'directory' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_index_runs_document_started
  ON document_index_runs(document_id, started_at DESC);
```

- [ ] **Step 4: Make migration idempotent for existing DBs**

In `migrate.ts`, after `db.exec(schemaSql)`, inspect `PRAGMA table_info` and add missing columns with `ALTER TABLE`. Implement a helper:

```ts
function ensureColumn(db: Database.Database, table: string, column: string, ddl: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
```

- [ ] **Step 5: Return new fields from document-store**

Update `listDocumentsByProject()` to select source and metric columns and map them into camelCase. Add `listDocumentIndexRuns(dbPath, documentId)` returning run history sorted by newest first.

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
pnpm -C web test -- tests/repos/document-store.test.ts tests/db/migrate.test.ts
```

Expected: pass.

---

### Task 2: Index Metrics And Token Accounting

**Files:**
- Add: `services/common/index_metrics.py`
- Add: `services/common/llm_metrics.py`
- Modify: `pageindex/utils.py`
- Test: `services/tests/test_index_metrics.py`

- [ ] **Step 1: Add failing Python tests for metrics aggregation**

Create tests that start a metrics context, call a fake LLM result with usage, and verify totals:

```py
with index_run_metrics() as metrics:
    metrics.record_llm_call(
        model="gpt-test",
        prompt_tokens=100,
        completion_tokens=25,
        elapsed_ms=30,
        token_source="provider_usage",
    )

assert metrics.snapshot()["llm_call_count"] == 1
assert metrics.snapshot()["prompt_tokens"] == 100
assert metrics.snapshot()["completion_tokens"] == 25
assert metrics.snapshot()["models"] == {"gpt-test": 1}
```

Add a fallback test that estimates Token counts when provider usage is missing.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
./.venv/bin/python -m pytest services/tests/test_index_metrics.py -q
```

Expected: fail because the metrics modules do not exist.

- [ ] **Step 3: Implement metrics context**

Implement `IndexRunMetrics` with named timers:

```py
with metrics.timer("pageindex_ms"):
    payload = build_pageindex_payload(...)
```

Expose a `contextvars.ContextVar[IndexRunMetrics | None]` so nested PageIndex calls can record usage without changing every function signature.

- [ ] **Step 4: Instrument PageIndex LLM helpers**

In `pageindex/utils.py`, keep public function signatures unchanged. After a LiteLLM response, extract:

```py
usage = getattr(response, "usage", None)
prompt_tokens = getattr(usage, "prompt_tokens", None)
completion_tokens = getattr(usage, "completion_tokens", None)
```

When usage is absent, estimate prompt and output with `count_tokens()`.

Record every call into the active metrics context. Repeat the same pattern for `llm_acompletion()`.

- [ ] **Step 5: Run metrics tests**

Run:

```bash
./.venv/bin/python -m pytest services/tests/test_index_metrics.py -q
```

Expected: pass.

---

### Task 3: Multi-Format Indexing And Run Persistence

**Files:**
- Modify: `services/index_worker/index_document.py`
- Add: `services/index_worker/vision.py`
- Modify: `services/index_worker/worker.py`
- Test: `services/tests/test_index_document.py`

- [ ] **Step 1: Add failing tests for run persistence**

Add tests covering:

- completed job inserts one `document_index_runs` row
- failed job inserts or updates a failed run
- skipped image without `VISION_MODEL` records zero Token usage
- directory metadata is included in `doc_description` and `source_metadata_json`

Expected assertion:

```py
run = conn.execute("SELECT status, duration_ms, total_tokens FROM document_index_runs").fetchone()
assert run[0] == "completed"
assert run[1] >= 0
assert run[2] == 0
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
./.venv/bin/python -m pytest services/tests/test_index_document.py -q
```

Expected: fail because index runs are not written.

- [ ] **Step 3: Load document metadata before indexing**

Change `process_document_job()` query to select:

```sql
d.file_name, d.storage_path, d.media_type, d.source_relative_path,
d.project_relative_path, p.name AS project_name
```

Use `media_type` to dispatch PDF, Markdown, text, or image indexing.

- [ ] **Step 4: Implement payload builders**

Keep the existing PDF path as the primary path. Add:

- Markdown: call `pageindex.page_index_md.md_to_tree(...)`; fallback to synthetic root if no headings.
- Text: create one synthetic root node and one page entry.
- Image: call `build_image_text_payload()` from `vision.py`; if vision is disabled, raise a typed skip exception.

Each payload must return:

```py
{
    "doc_name": "...",
    "doc_description": "...",
    "structure": [...],
    "pages": [{"page": 1, "content": "..."}],
    "page_count": 1,
    "evidence_kind": "image_caption",
    "visual_assets": [],
    "source_metadata": {},
}
```

- [ ] **Step 5: Persist run metrics**

Create a run at the beginning of `process_document_job()`, wrap payload generation with metrics timers, and finish it after DB persistence. On exceptions, update the run to `failed` or `skipped` with captured metrics.

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
./.venv/bin/python -m pytest services/tests/test_index_document.py -q
```

Expected: pass.

---

### Task 4: Directory Scanner And Watch Worker

**Files:**
- Add: `services/directory_watcher/__init__.py`
- Add: `services/directory_watcher/sync.py`
- Add: `services/directory_watcher/worker.py`
- Modify: `services/common/settings.py`
- Test: `services/tests/test_directory_sync.py`

- [ ] **Step 1: Add failing directory sync tests**

Use a temporary corpus:

```text
ProjectA/delivery/report.md
ProjectA/photos/site.png
ProjectB/handover/report.txt
```

Assert:

- two projects are created
- three documents are inserted
- `ProjectA/delivery/report.md` is stored as `source_relative_path`
- `delivery/report.md` is stored as `project_relative_path`
- changed file hash queues a new job
- deleted source file sets `deleted_at` and `import_status='deleted'`

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
./.venv/bin/python -m pytest services/tests/test_directory_sync.py -q
```

Expected: fail because directory watcher modules do not exist.

- [ ] **Step 3: Implement path classification**

Implement helpers:

```py
def classify_source_file(root: Path, file_path: Path) -> SourceFile:
    relative = file_path.relative_to(root)
    project_name = relative.parts[0]
    project_relative_path = Path(*relative.parts[1:]).as_posix()
```

Reject files directly under `PROJECTS_ROOT` because they have no project folder.

- [ ] **Step 4: Implement idempotent upsert**

Use SQLite transactions to:

- find or create project by normalized folder name
- find document by `source_kind='directory'` and `source_relative_path`
- update metadata and queue a job only when hash, mtime, or size changes
- mark missing directory documents deleted

- [ ] **Step 5: Implement polling watcher**

In `worker.py`, run:

```py
sync_once(str(DB_PATH), PROJECTS_ROOT)
while True:
    time.sleep(DIRECTORY_SCAN_INTERVAL_SECONDS)
    sync_once(str(DB_PATH), PROJECTS_ROOT)
```

The poller is the first implementation of continuous watch. It is simpler and more reliable in Docker-mounted folders than platform-specific file event APIs.

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
./.venv/bin/python -m pytest services/tests/test_directory_sync.py -q
```

Expected: pass.

---

### Task 5: Evidence-First Retrieval With Path Metadata

**Files:**
- Modify: `services/retrieval_api/schemas.py`
- Modify: `services/retrieval_api/select_documents.py`
- Modify: `services/retrieval_api/query_engine.py`
- Test: `services/tests/test_select_documents.py`
- Test: `services/tests/test_query_engine.py`

- [ ] **Step 1: Add failing retrieval tests**

Add tests that verify:

- document selection prompt includes project-relative path
- keyword fallback scores path tokens
- evidence response includes `sourceRelativePath`, `projectRelativePath`, `content`, `evidenceKind`, and `visualAssets`
- existing answer mode still returns `answer`, `citations`, and `selectedDocuments`

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
./.venv/bin/python -m pytest services/tests/test_select_documents.py services/tests/test_query_engine.py -q
```

Expected: fail because path fields are not loaded or returned.

- [ ] **Step 3: Extend schemas**

Add:

```py
class QueryRequest(BaseModel):
    query: str = Field(min_length=1)
    projectIds: list[str] = Field(min_length=1)
    mode: str = "answer"
```

Add `EvidenceItem` and allow `QueryResponse` to include `evidence`.

- [ ] **Step 4: Include path fields in candidate selection**

Update keyword haystack and LLM candidate prompt to include:

```py
project_name
file_name
source_relative_path
project_relative_path
doc_description
```

- [ ] **Step 5: Build evidence packages**

In `answer_question()`, load source and evidence metadata columns, and return evidence blocks when `mode == "evidence"`. Keep answer mode backwards compatible.

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
./.venv/bin/python -m pytest services/tests/test_select_documents.py services/tests/test_query_engine.py -q
```

Expected: pass.

---

### Task 6: Metrics API And UI Display

**Files:**
- Modify: `web/lib/repos/document-store.ts`
- Add: `web/app/api/documents/[documentId]/index-runs/route.ts`
- Modify: `web/components/document-table.tsx`
- Test: `web/tests/repos/document-store.test.ts`
- Test: `web/tests/components/document-table.test.tsx`
- Test: `web/tests/api/document-index-runs-route.test.ts`

- [ ] **Step 1: Add failing UI/API tests**

Add component assertions:

```ts
expect(screen.getByText("1.5s")).toBeInTheDocument();
expect(screen.getByText("4.2K tokens")).toBeInTheDocument();
expect(screen.getByText("delivery/handover.md")).toBeInTheDocument();
```

Add route test verifying `GET /api/documents/doc_1/index-runs` returns newest runs.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm -C web test -- tests/components/document-table.test.tsx tests/api/document-index-runs-route.test.ts tests/repos/document-store.test.ts
```

Expected: fail because UI columns and API route do not exist.

- [ ] **Step 3: Render path and metrics columns**

Update `DocumentTableRow` with:

```ts
sourceRelativePath?: string | null;
projectRelativePath?: string | null;
lastIndexDurationMs?: number | null;
lastIndexTotalTokens?: number | null;
lastIndexLlmCallCount?: number | null;
lastIndexedAt?: string | null;
```

Add compact formatting helpers for milliseconds and Token counts.

- [ ] **Step 4: Implement index-runs route**

Use `listDocumentIndexRuns(appConfig.dbPath, documentId)` and return:

```ts
return NextResponse.json({ runs });
```

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
pnpm -C web test -- tests/components/document-table.test.tsx tests/api/document-index-runs-route.test.ts tests/repos/document-store.test.ts
```

Expected: pass.

---

### Task 7: Docker Runtime

**Files:**
- Add: `Dockerfile`
- Add: `.dockerignore`
- Add: `docker-compose.yml`
- Add: `docker/entrypoints/web.sh`
- Add: `docker/entrypoints/retrieval-api.sh`
- Add: `docker/entrypoints/index-worker.sh`
- Add: `docker/entrypoints/directory-watcher.sh`
- Modify: `README.md`

- [ ] **Step 1: Add Docker runtime files**

Use one image that installs Python requirements and web dependencies. Compose runs four commands from the same image:

```yaml
services:
  web:
    command: ["./docker/entrypoints/web.sh"]
  retrieval-api:
    command: ["./docker/entrypoints/retrieval-api.sh"]
  index-worker:
    command: ["./docker/entrypoints/index-worker.sh"]
  directory-watcher:
    command: ["./docker/entrypoints/directory-watcher.sh"]
```

Mount:

```yaml
volumes:
  - ./var:/app/var
  - ${PROJECTS_ROOT:-./fixtures/projects}:/data/projects:ro
```

- [ ] **Step 2: Ensure DB migration runs before services**

The web entrypoint must run:

```bash
pnpm -C web db:migrate
pnpm -C web start
```

Worker entrypoints must run migration defensively before starting Python workers.

- [ ] **Step 3: Document the Docker workflow**

Add README commands:

```bash
PROJECTS_ROOT=/absolute/path/to/projects docker compose up --build
```

Document required model environment variables and vision settings.

- [ ] **Step 4: Build the Docker image**

Run:

```bash
docker compose build
```

Expected: image builds successfully.

---

### Task 8: End-To-End Verification

**Files:**
- Use existing source files and temporary fixture data under `var/smoke-projects`

- [ ] **Step 1: Run full Python tests**

Run:

```bash
./.venv/bin/python -m pytest services/tests -q
```

Expected: all service tests pass.

- [ ] **Step 2: Run full web tests**

Run:

```bash
pnpm -C web test
```

Expected: all web tests pass.

- [ ] **Step 3: Run a local directory sync smoke test**

Create:

```text
var/smoke-projects/ProjectA/delivery/report.md
var/smoke-projects/ProjectB/handover/report.txt
```

Run:

```bash
PROJECTS_ROOT="$PWD/var/smoke-projects" ./.venv/bin/python -m services.directory_watcher.sync --once
```

Expected: DB contains two projects, two documents, queued jobs, and correct relative paths.

- [ ] **Step 4: Run Docker smoke test**

Run:

```bash
PROJECTS_ROOT="$PWD/var/smoke-projects" docker compose up --build
```

Expected:

- web responds on `http://localhost:3000`
- retrieval API responds on `http://localhost:8001/docs`
- directory watcher imports fixture documents
- index worker records `document_index_runs`
- document table shows parse duration and Token usage after indexing

- [ ] **Step 5: Stop Docker services**

Run:

```bash
docker compose down
```

Expected: containers stop cleanly and `var/` retains DB state.
