# Project-Centric Knowledge Chat Design

## Goal

Build a project-centric knowledge chat application on top of the current PageIndex core.

The system manages documents by project. Users upload PDF documents into projects, then start chats scoped to one or more projects. Each chat uses PageIndex-based retrieval and returns answers with document and page citations.

## Context

The current repository already provides the retrieval-engine layer:

- PDF indexing into hierarchical tree structures
- Markdown indexing into hierarchical tree structures
- Document metadata access
- Structure-tree access
- Page-content access
- Single-document agentic QA orchestration

Relevant existing code:

- [`pageindex/client.py`](/Users/oam/Workspace/demos/PageIndexDemo/pageindex/client.py)
- [`pageindex/retrieve.py`](/Users/oam/Workspace/demos/PageIndexDemo/pageindex/retrieve.py)
- [`pageindex/page_index.py`](/Users/oam/Workspace/demos/PageIndexDemo/pageindex/page_index.py)
- [`pageindex/page_index_md.py`](/Users/oam/Workspace/demos/PageIndexDemo/pageindex/page_index_md.py)
- [`examples/agentic_vectorless_rag_demo.py`](/Users/oam/Workspace/demos/PageIndexDemo/examples/agentic_vectorless_rag_demo.py)

The repository does not yet provide the product layer:

- project management
- document upload UX
- conversation persistence
- multi-document selection across projects
- job orchestration
- user-facing application shell

## Product Constraints

- Primary interaction model should directly follow `https://chat.pageindex.ai/chat`
- Business model is simplified to project-level document management
- A project is the top-level container for uploaded documents
- First release supports PDF upload only
- A chat can be scoped to one or more projects
- Project count is limited enough that each project has at most about 100 documents
- Cross-project retrieval is possible, but only within explicitly selected projects

## Scope

### In Scope

- project list and project creation
- per-project PDF upload
- document indexing status
- chat history in the left sidebar
- project-scoped and multi-project chat
- PageIndex-based retrieval with citations
- conversation persistence

### Out of Scope

- nested folders inside projects
- public library
- multi-user project collaboration
- role-based permissions
- vector database as a required dependency
- OCR-heavy scanned-document pipeline

## User Experience

### Application Shell

The UI has a fixed left sidebar and a main content area on the right.

Left sidebar:

- logo
- collapse toggle
- `New Chat`
- `Projects`
- `Chats`
- settings/theme controls at the bottom

Right main area:

- chat view
- projects view

### Projects View

Purpose: manage projects and upload project documents.

Top controls:

- page title
- `New Project`
- search input

Main area:

- project grid or list, visually similar to a folder/file manager
- each project card shows:
  - project name
  - document count
  - last updated time

When entering a project:

- breadcrumb/header
- `Upload`
- document search
- document list

Each document row shows:

- file name
- page count
- indexing status
- upload time

### Chat View

Purpose: query one or more selected projects with natural language.

Layout follows the reference site:

- top header with conversation title and selected project scope
- center message list
- fixed bottom composer

Composer contains:

- project scope picker
- message input
- send button

Chat behavior:

- user must select at least one project before sending
- selected project scope is persisted to the conversation
- assistant answers include citations:
  - project name
  - document name
  - pages

### Chat History

Left sidebar lists recent conversations.

Each item shows:

- conversation title
- current project scope summary, either:
  - one project name
  - `Multiple projects`

Selecting a conversation restores:

- messages
- selected project scope

## Architecture

Recommended architecture:

1. Next.js web application for UI and BFF routes
2. Python indexing worker for document indexing
3. Python retrieval service for retrieval orchestration on top of PageIndex core

### Why This Split

The current repository is already strong at indexing and retrieval primitives, but weak at product-shell concerns. The application layer should not directly embed complex PageIndex workflows in browser-facing routes.

This split keeps:

- product logic in the web layer
- indexing and retrieval logic in the Python layer
- PageIndex core isolated and reusable

## System Components

### Web App / BFF

Responsibilities:

- render the application shell
- expose REST APIs to the frontend
- persist projects, documents, conversations, and jobs
- store uploaded files
- dispatch indexing jobs
- call retrieval service during chat

### Index Worker

Responsibilities:

- consume `document_index` jobs
- call PageIndex on uploaded PDFs
- save generated structure, summaries, descriptions, and page text
- update document status

### Retrieval Orchestrator

Responsibilities:

- select candidate documents across selected projects
- run PageIndex retrieval on selected documents
- compose final answer with citations

### PageIndex Core

Responsibilities:

- single-document structure generation
- single-document structure access
- single-document page-content access

## Retrieval Strategy

The core design requirement is multi-document retrieval across one or more selected projects.

PageIndex itself is treated as the fine-grained retrieval engine, not the top-level document selector.

### Two-Stage Retrieval

1. coarse document selection
2. PageIndex-based fine retrieval

### Stage 1: Candidate Selection

Input:

- selected project IDs
- user query

Candidate documents are limited to `ready` documents inside the selected projects.

Use metadata available in application storage:

- project name
- file name
- document description

Recommended first-release coarse selection:

- database full-text search or keyword scoring on file name and description
- then LLM reranking over the top 20-30 candidate documents
- keep top 5-8 documents for fine retrieval

This is intentionally lighter than introducing a vector database in the first release.

### Stage 2: PageIndex Fine Retrieval

For each selected candidate document:

- call document metadata access
- call structure-tree access
- identify likely relevant sections/page ranges
- fetch page content for narrow ranges

Then synthesize an answer with explicit citations.

## Data Model

### projects

- `id`
- `owner_user_id`
- `name`
- `created_at`
- `updated_at`
- `deleted_at`

### documents

- `id`
- `project_id`
- `owner_user_id`
- `file_name`
- `storage_path`
- `mime_type`
- `file_size`
- `page_count`
- `status`
- `error_message`
- `created_at`
- `updated_at`
- `deleted_at`

### document_indexes

- `id`
- `document_id`
- `doc_name`
- `doc_description`
- `structure_json`
- `pages_json`
- `index_version`
- `indexed_at`

### conversations

- `id`
- `owner_user_id`
- `title`
- `created_at`
- `updated_at`
- `deleted_at`

### conversation_projects

- `conversation_id`
- `project_id`
- `created_at`

### conversation_messages

- `id`
- `conversation_id`
- `role`
- `content`
- `citations_json`
- `created_at`

### jobs

- `id`
- `type`
- `document_id`
- `payload_json`
- `status`
- `progress`
- `error_message`
- `created_at`
- `updated_at`
- `finished_at`

## API Design

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`

### Documents

- `GET /api/projects/:projectId/documents`
- `POST /api/projects/:projectId/documents/upload`
- `GET /api/documents/:documentId`
- `DELETE /api/documents/:documentId`
- `POST /api/documents/:documentId/reindex`
- `GET /api/documents/:documentId/structure`
- `GET /api/documents/:documentId/pages?pages=5-7`

### Conversations

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:conversationId`
- `PATCH /api/conversations/:conversationId`
- `DELETE /api/conversations/:conversationId`
- `PUT /api/conversations/:conversationId/projects`

### Chat

- `POST /api/chat/send`

### Jobs

- `GET /api/jobs/:jobId`

## Internal Service Contracts

### Indexing

- `POST /internal/index/document`

Input:

- document ID
- file path or storage key

Output:

- document structure
- page text
- metadata

### Retrieval

- `POST /internal/retrieve/select-documents`
- `POST /internal/retrieve/query`

`select-documents` returns candidate documents.

`query` returns:

- answer text
- citations

## State Machines

### Document Status

- `uploaded`
- `indexing`
- `ready`
- `failed`
- `deleted`

Allowed transitions:

- `uploaded -> indexing`
- `indexing -> ready`
- `indexing -> failed`
- `failed -> indexing`
- `ready -> indexing`
- any active state -> `deleted`

### Conversation Status

For first release, status can remain implicit:

- draft: created but no messages
- active: contains messages

No archive state is required for release one.

## Workflow Details

### Upload Workflow

1. user uploads one or more PDFs to a project
2. BFF stores files and creates `documents` rows
3. BFF creates indexing jobs
4. worker starts indexing and marks documents `indexing`
5. worker writes `document_indexes`
6. worker marks documents `ready`

### Chat Workflow

1. user opens or creates a conversation
2. user selects one or more projects
3. user sends a message
4. BFF loads ready documents in the selected projects
5. coarse selector narrows candidate documents
6. retrieval orchestrator calls PageIndex on top candidates
7. answer and citations are returned
8. conversation message is persisted

## Error Handling

### User-Facing Cases

- no selected projects: disable send and return validation error if needed
- selected projects contain no ready documents: return explicit empty-state message
- documents still indexing: exclude them from retrieval and show their status in Projects view
- all candidate documents fail retrieval: return a generic retrieval failure

### System Cases

- partial document failures should not fail the entire chat request if some documents still succeed
- malformed page range requests should return 400-level validation errors
- indexing failures should persist error messages for explicit reindex operations

## Testing Strategy

### Unit Tests

- project scope resolution
- document coarse selection
- citation formatting
- state transitions

### Integration Tests

- upload -> index -> ready
- create conversation -> bind projects -> send message -> save citations

### End-to-End Tests

- create project
- upload document
- wait for ready state
- start chat
- verify answer and citations
- reopen conversation from sidebar

## Implementation Notes

### Existing Code Reuse

Use current repository code with minimal duplication:

- `pageindex.client.PageIndexClient` for indexing and workspace persistence
- `pageindex.retrieve` as the primitive retrieval layer
- `examples/agentic_vectorless_rag_demo.py` as the starting point for single-document retrieval orchestration

### Constraints for Release One

- no public library
- no nested folders
- no collaboration model
- no vector dependency required
- PDF-first workflow only

## Recommended Next Step

Write an implementation plan that splits the work into:

1. application shell and projects UI
2. document upload and indexing
3. conversation persistence
4. multi-project retrieval orchestration
5. citations and chat UX
