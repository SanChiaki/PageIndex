# Directory Knowledge Retrieval Service Design

## Goal

Turn the current PageIndex demo into a Docker-runnable retrieval service that can
watch a mounted project corpus directory, import documents automatically, index
relative paths as retrieval context, and return evidence packages for downstream
post-processing.

Report generation is out of scope for this phase. The service must retrieve
and expose high-quality source evidence that another process can use later.

## Current Context

The repository already has the main product layers:

- `web/`: Next.js UI and API routes for projects, documents, chat, and local DB
  migration.
- `services/index_worker`: a Python worker that claims `document_index` jobs and
  writes PageIndex payloads into SQLite.
- `services/retrieval_api`: a FastAPI service that selects candidate documents,
  runs PageIndex-style page selection, and returns answers with citations.
- `services/common`: shared Python settings and SQLite helpers.

Current gaps for directory-based retrieval:

- documents have no source-relative path fields
- directory import is manual upload only
- no file fingerprinting exists for incremental sync
- Docker orchestration is not defined
- image files and image-heavy PDFs are not represented as searchable evidence
- indexing jobs do not record parse duration or Token usage

## Product Scope

### In Scope

- Run the full app stack with Docker Compose.
- Mount a host corpus directory into the container.
- Treat the first path segment under the corpus root as the project name.
- Recursively import files under each project folder.
- Preserve nested subfolders as relative path metadata.
- Re-scan the corpus at startup.
- Watch the corpus for file create, update, move, and delete events.
- Queue indexing only when a supported file changes.
- Include project name and relative path in document selection and evidence.
- Return retrieval evidence packages suitable for later post-processing.
- Support text-first document formats and image-derived text evidence.
- Track document parsing and indexing duration.
- Track LLM call count and Token usage for indexing and visual extraction.
- Show the latest parse metrics in the UI and expose run history through an API.

### Out of Scope

- Final report generation.
- Report template management.
- Multi-user permissions.
- Distributed workers.
- Object storage.
- OCR-perfect reconstruction of complex scanned documents.
- Editable document authoring.

## Directory Semantics

The corpus root is configured with `PROJECTS_ROOT`.

Example:

```text
/data/projects/
  ProjectA/
    delivery/
      acceptance-report.pdf
      site-photo.jpg
    design/
      high-level-design.md
  ProjectB/
    acceptance-report.pdf
```

Rules:

- `ProjectA` and `ProjectB` become projects.
- `delivery/acceptance-report.pdf` is the project-relative path.
- `ProjectA/delivery/acceptance-report.pdf` is the corpus-relative path.
- nested folders are preserved and displayed in retrieval citations.
- file names alone are not unique; identity is based on source-relative path and
  fingerprint.

## Supported Inputs

### Phase 1 Formats

- PDF: indexed with existing PageIndex PDF flow.
- Markdown: indexed with the existing PageIndex Markdown flow. If the Markdown
  parser cannot produce a structure, the worker falls back to a flat text
  payload with one synthetic root node.
- Plain text: wrapped into a lightweight pseudo-document for indexing.
- Images: converted into text evidence with a configured vision model before
  retrieval. The vision prompt must request OCR-like visible text extraction
  plus a concise semantic caption. Local OCR engines such as Tesseract are not
  part of the first implementation.

### Image Extensions

Supported standalone image files:

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.tif`
- `.tiff`

Unsupported binary files must be marked as skipped, not failed.

## Image Handling Strategy

Images must become retrievable without requiring the downstream post-processor
to inspect raw pixels first.

### Standalone Images

For each image file:

1. store source metadata exactly like a document
2. generate an image evidence text payload
3. save the original image path for later visual review
4. index the generated text payload

The generated image evidence text must contain:

- short caption
- visible text transcribed by the vision model
- detected tables, diagrams, screenshots, forms, or site photos when visible
- project name
- project-relative path
- image dimensions if available

The implementation must use a configurable vision model through the same LLM
provider mechanism as PageIndex. If no vision model is configured, images are
imported as `skipped` with a clear reason.

### PDF Pages With Images

PDFs remain text-first. During indexing, the worker must detect pages with low
or empty extracted text. When `VISION_EXTRACTION_ENABLED=true` and `VISION_MODEL`
is configured, it must render those pages to images with PyMuPDF.

For those pages:

- generate page-level visual text with the same vision extraction path
- merge visual text into the page content used for retrieval
- preserve that the evidence came from visual extraction

This keeps scanned or image-heavy PDFs searchable while still using the current
PageIndex structure flow when text extraction is available.

### Markdown Images

Markdown files must preserve image references in their generated text evidence.
For local relative image links inside the project folder:

- resolve the image path under the same project root
- run image extraction if the image is supported
- append the generated caption near the Markdown reference
- record the image as a linked asset, not a separate top-level document unless it
  also appears as a standalone corpus file

## Data Model Additions

Add source and retrieval metadata to `documents`:

- `source_kind`: `upload`, `directory`
- `source_root`: configured root label or path
- `source_relative_path`: path from corpus root
- `project_relative_path`: path under the project folder
- `content_hash`: hash of the source bytes or normalized text payload
- `source_mtime`: source file modified time
- `source_size`: source file size
- `media_type`: `pdf`, `markdown`, `text`, `image`, `unsupported`
- `import_status`: `imported`, `skipped`, `deleted`
- `import_error`: nullable reason for skipped or failed imports

Add nullable evidence metadata columns to `document_indexes`:

- `evidence_kind`: `text`, `pdf_text`, `pdf_visual`, `image_caption`,
  `markdown_text`
- `visual_assets_json`: image/page asset references
- `source_metadata_json`: path, hash, mtime, and extraction metadata

The first implementation must avoid adding a companion evidence table. The
retrieval API can read source fields from `documents` and evidence fields from
`document_indexes`.

Add a `document_index_runs` table for observability:

- `id`: run id
- `document_id`: indexed document
- `job_id`: indexing job when available
- `status`: `running`, `completed`, `failed`, `skipped`
- `started_at`: run start time
- `finished_at`: run finish time
- `duration_ms`: total wall-clock indexing duration
- `text_extraction_ms`: PDF, Markdown, text, or image payload extraction time
- `pageindex_ms`: PageIndex structure generation time
- `vision_extraction_ms`: image or visual PDF page extraction time
- `persist_ms`: SQLite persistence time
- `llm_call_count`: total model calls made during the run
- `prompt_tokens`: total input tokens
- `completion_tokens`: total output tokens
- `total_tokens`: prompt plus completion tokens
- `token_source`: `provider_usage` or `estimated`
- `models_json`: model names and per-model call counts
- `error_message`: failure reason when the run fails

Keep the latest metrics denormalized on `documents` for fast list rendering:

- `last_index_duration_ms`
- `last_index_total_tokens`
- `last_index_llm_call_count`
- `last_indexed_at`

## Import And Watch Flow

### Startup Scan

On service startup:

1. create or update projects for every first-level directory
2. recursively enumerate supported and unsupported files
3. compute mtime, size, and hash for each supported file
4. upsert `documents` rows by `source_relative_path`
5. enqueue `document_index` jobs for new or changed files
6. mark missing previously imported files as deleted

### Continuous Watch

The directory watcher must use a debounce window to avoid indexing partially
written files.

Recommended behavior:

- wait until file size and mtime are stable across two checks
- ignore temporary files and hidden system files
- batch rapid events into one sync pass
- enqueue at most one active index job per document

## Parse Metrics And Token Accounting

Every indexing attempt must create one `document_index_runs` row. The run starts
when the worker begins processing a document and finishes after status, index
payload, metrics, and errors have been persisted.

Measure wall-clock duration with a monotonic clock for:

- source text or image payload extraction
- PageIndex structure generation
- vision extraction for standalone images and image-heavy PDF pages
- persistence
- total run duration

Token accounting must wrap the existing PageIndex LLM entry points:

- `pageindex.utils.llm_completion`
- `pageindex.utils.llm_acompletion`
- the new vision extraction helper

For each model call, record:

- model name
- prompt token count
- completion token count
- total token count
- elapsed milliseconds
- whether the counts came from provider usage metadata or local estimation

Preferred Token source:

- use provider usage metadata from LiteLLM responses when present
- fall back to `litellm.token_counter` for prompt and response text when provider
  usage is missing

The worker must aggregate per-call records into the `document_index_runs` row.
Detailed per-call records are stored in `source_metadata_json` when
`INDEX_DEBUG_METRICS=true`; otherwise only aggregate fields are persisted. The
UI only needs the aggregate fields in the first implementation.

Metrics must cover skipped images too:

- if an image is skipped because `VISION_MODEL` is not configured, create a
  skipped run with duration and zero Token usage
- if vision extraction fails, create a failed run with elapsed time and any
  Token usage captured before the failure

## Retrieval Contract

The retrieval API must support evidence-first responses.

Request:

```json
{
  "query": "generate an acceptance report using similar delivery reports",
  "projectIds": ["proj_a", "proj_b"],
  "mode": "evidence"
}
```

Response:

```json
{
  "answer": "",
  "evidence": [
    {
      "projectId": "proj_a",
      "projectName": "ProjectA",
      "documentId": "doc_1",
      "documentName": "acceptance-report.pdf",
      "sourceRelativePath": "ProjectA/delivery/acceptance-report.pdf",
      "projectRelativePath": "delivery/acceptance-report.pdf",
      "pages": "2-4",
      "evidenceKind": "pdf_text",
      "excerpt": "Acceptance scope, milestones, and handover criteria...",
      "content": "...",
      "visualAssets": []
    }
  ],
  "selectedDocuments": [
    {
      "documentId": "doc_1",
      "sourceRelativePath": "ProjectA/delivery/acceptance-report.pdf"
    }
  ]
}
```

The existing answer-oriented chat response can remain for the UI. The new
evidence response is the stable integration surface for downstream processing.

## Metrics Viewing Contract

The UI must show latest document parse metrics in the project document list or
document detail view:

- last parse status
- last parse duration
- last Token usage
- LLM call count
- last indexed time

Expose run history through an API:

```http
GET /api/documents/:documentId/index-runs
```

Response:

```json
{
  "runs": [
    {
      "id": "run_1",
      "status": "completed",
      "startedAt": "2026-04-25T10:00:00Z",
      "finishedAt": "2026-04-25T10:01:20Z",
      "durationMs": 80000,
      "textExtractionMs": 1200,
      "pageindexMs": 76000,
      "visionExtractionMs": 0,
      "persistMs": 200,
      "llmCallCount": 12,
      "promptTokens": 38000,
      "completionTokens": 4200,
      "totalTokens": 42200,
      "tokenSource": "provider_usage",
      "models": {
        "gpt-4.1": 12
      },
      "errorMessage": null
    }
  ]
}
```

## Candidate Selection Changes

Candidate selection must include:

- project name
- file name
- project-relative path
- source-relative path
- document description
- extracted image captions or visual text summary

This makes queries like "find similar acceptance reports" match not only by
content but also by folder conventions such as `acceptance`, `delivery`,
`handover`, or `design`.

## Docker Runtime

Add a Docker Compose setup with four services:

- `web`: Next.js application
- `retrieval-api`: FastAPI retrieval API
- `index-worker`: PageIndex indexing worker
- `directory-watcher`: corpus sync and file watch worker

Shared mounts:

- `/app/var`: SQLite DB, uploads, generated extraction artifacts
- `/data/projects`: read-only corpus mount, configured by
  `PROJECTS_ROOT`

Environment:

- `APP_VAR_ROOT=/app/var`
- `APP_DB_PATH=/app/var/app.db`
- `APP_UPLOAD_ROOT=/app/var/uploads`
- `PROJECTS_ROOT=/data/projects`
- `RETRIEVAL_API_BASE_URL=http://retrieval-api:8001`
- `VISION_MODEL`, optional for text-only deployments
- `VISION_EXTRACTION_ENABLED=true|false`

## Error Handling

- Unsupported files are skipped with a visible reason.
- Image extraction failures mark only that document as failed or skipped.
- A failed file must not stop the watcher.
- Repeated failures must not enqueue infinite retry loops.
- Deleted source files are soft-deleted in the DB.
- Existing manually uploaded documents remain valid and are not affected by
  directory sync.

## Testing Strategy

### Unit Tests

- path-to-project mapping
- nested relative path preservation
- file fingerprint changes
- unsupported file skip behavior
- candidate selection using path fields
- evidence response serialization
- parse metrics aggregation
- Token accounting fallback from provider usage to local estimation

### Integration Tests

- startup scan creates projects and documents
- changed file queues a reindex job
- deleted file marks document deleted
- standalone image without vision config is skipped with a clear reason
- image with mocked vision extraction becomes searchable text evidence
- indexing a document creates a completed run with duration and Token metrics
- failed indexing creates a failed run with captured partial metrics

### Docker Smoke Test

Use a tiny fixture corpus:

```text
fixtures/projects/
  ProjectA/
    delivery/report.md
    delivery/site-photo.png
  ProjectB/
    handover/report.pdf
```

Expected smoke result:

- `docker compose up` starts all services
- DB migration runs
- watcher imports both projects
- text documents are queued for indexing
- image is indexed when `VISION_MODEL` is configured or skipped when not
- retrieval API returns evidence containing source-relative paths
- document list or detail view shows latest parse duration and Token usage

## Acceptance Criteria

- A user can run the stack with Docker Compose.
- The stack can point to a mounted folder containing multiple project folders.
- The watcher imports nested project files automatically.
- Relative paths are stored and returned in retrieval evidence.
- Changed files are re-indexed without manual upload.
- Deleted files stop participating in retrieval.
- Candidate selection considers project names and relative paths.
- Standalone image files are handled deterministically.
- Image-heavy PDF pages can contribute visual text when vision extraction is
  enabled.
- Retrieval returns a structured evidence package suitable for later
  post-processing.
- Each index attempt records duration, model call count, Token usage, and status.
- Users can view latest parse metrics for each document.
- Users can inspect index run history for a document through an API.
