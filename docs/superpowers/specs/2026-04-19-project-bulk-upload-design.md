# Project Bulk Upload Design

## Goal

Extend the existing per-project PDF upload flow so a user can select and upload multiple PDF files in one action from the project detail page.

The system must support partial success:

- valid PDFs in the batch continue to upload and enqueue indexing jobs
- invalid or failed files are reported individually
- one failed file must not block the rest of the batch

## Current Context

The current implementation only supports a single uploaded file per request:

- the upload modal stores one `selectedFile`
- the browser request sends one `file` field
- the API route validates and persists one file, then returns one uploaded item

Relevant files:

- [`web/components/document-upload-modal.tsx`](/Users/oam/Workspace/demos/PageIndexDemo/web/components/document-upload-modal.tsx)
- [`web/app/api/projects/[projectId]/documents/upload/route.ts`](/Users/oam/Workspace/demos/PageIndexDemo/web/app/api/projects/[projectId]/documents/upload/route.ts)
- [`web/lib/storage/local-files.ts`](/Users/oam/Workspace/demos/PageIndexDemo/web/lib/storage/local-files.ts)
- [`web/tests/api/task2-routes-hardening.test.ts`](/Users/oam/Workspace/demos/PageIndexDemo/web/tests/api/task2-routes-hardening.test.ts)

## Scope

### In Scope

- select multiple PDFs in the existing upload modal
- upload all selected files through the existing project upload endpoint
- process each file independently on the server
- return per-file success and failure results
- show a batch upload summary in the modal
- keep single-file uploads working

### Out of Scope

- drag-and-drop upload
- upload progress bars per file
- retry queue in the UI
- zip uploads or folder uploads
- mixed document types beyond PDF

## Recommended Approach

Keep the existing endpoint and extend it to accept repeated `files` form entries while remaining backward compatible with the existing single `file` entry.

Why this approach:

- no new route surface area
- minimal frontend integration change
- preserves current tests and clients
- lets the server own partial-success semantics in one place

## UX Changes

### Upload Modal

The project upload modal remains the only entry point.

Changes:

- file picker uses `multiple`
- modal copy changes from singular to plural
- selected state shows:
  - file count
  - file names as a compact list
- submit button becomes enabled when at least one file is selected

### Submission Result

After submit:

- if at least one file uploaded successfully:
  - close the modal
  - refresh the page so new document rows appear
- if all files failed:
  - keep the modal open
  - show the failure summary

The modal should show a concise summary before close when failures exist:

- `X uploaded, Y failed`

For failed items, render a flat list:

- file name
- error message

## API Contract

### Request

`POST /api/projects/:projectId/documents/upload`

Accepted form-data fields:

- `files`: repeated `File` entries for batch upload
- `file`: single `File` entry for backward compatibility

Server behavior:

- normalize request into a file list
- reject the request with `400` if no files are present

### Response

If at least one file succeeds, return `201`:

```json
{
  "uploaded": [
    {
      "documentId": "doc_123",
      "fileName": "alpha.pdf",
      "status": "uploaded",
      "jobId": "job_123"
    }
  ],
  "failed": [
    {
      "fileName": "broken.pdf",
      "error": "Uploaded file is not a valid PDF."
    }
  ]
}
```

If every file fails validation or storage, return `400`:

```json
{
  "uploaded": [],
  "failed": [
    {
      "fileName": "broken.pdf",
      "error": "Uploaded file is not a valid PDF."
    }
  ]
}
```

If the target project does not exist, return `404` exactly as today.

Unexpected infrastructure failures that prevent evaluating the batch at all may still return `500`.

## Validation Rules

Each file is validated independently:

- must be a `File`
- MIME type must be `application/pdf`
- first bytes must match the PDF signature
- storage save must succeed

Per-file validation failures become entries in `failed[]`.

The route must continue processing the rest of the batch after one file fails validation or storage.

## Persistence Rules

For each successful file:

1. save file to local upload storage
2. create a `documents` row
3. create an indexing job
4. append one item to `uploaded[]`

Failed files must not create partial database records.

## Testing Strategy

### API Tests

Add route coverage for:

- request with multiple files where one succeeds and one fails
- request with no files
- request with only invalid files returning `400`
- backward compatibility for existing single-file upload behavior

### Component Tests

Add upload modal coverage for:

- selecting multiple files updates the visible selection summary
- submit sends all selected files in one request
- partial-failure payload renders a readable failure summary

## Risks and Mitigations

### Risk: Ambiguous response semantics

Mitigation:

- response always includes both `uploaded` and `failed`
- status code depends on whether any file succeeded

### Risk: Regressing single-file uploads

Mitigation:

- normalize both `file` and `files`
- keep single-file tests in place

### Risk: UI hides partial failures by closing immediately

Mitigation:

- show a summary message before close when failures exist, or preserve the summary after refresh in a lightweight follow-up state if needed during implementation
- first implementation should prefer correctness of batch processing over polished toast behavior

## Acceptance Criteria

- a user can pick multiple PDFs from the project upload modal
- the request uploads all selected files in one action
- valid files are persisted and enqueued even when another file fails
- invalid files are listed with per-file error messages
- the document table refreshes after at least one success
- existing single-file upload behavior still works
