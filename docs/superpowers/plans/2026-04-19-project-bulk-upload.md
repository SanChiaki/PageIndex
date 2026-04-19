# Project Bulk Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the project document upload flow so one request can upload multiple PDFs with per-file success/failure results and a UI that clearly reports partial success.

**Architecture:** Keep the existing project upload route and extend it to normalize either repeated `files` entries or the legacy single `file` entry into one batch-processing path. On the client, convert the upload modal from single-file state to multi-file state, keep the modal open on partial success so failed-file details remain visible, and refresh the page when any upload succeeds.

**Tech Stack:** Next.js App Router, React, TypeScript, FormData, better-sqlite3, Vitest, Testing Library

---

## File Structure

- Modify: `web/app/api/projects/[projectId]/documents/upload/route.ts`
  Responsibility: normalize upload payloads, validate each file independently, persist successful files, and return `{ uploaded, failed }`.
- Modify: `web/tests/api/task2-routes-hardening.test.ts`
  Responsibility: route-level regression coverage for empty uploads, partial success, and backward compatibility.
- Create: `web/tests/components/document-upload-modal.test.tsx`
  Responsibility: UI behavior coverage for multi-select, batch submission, and partial-failure rendering.
- Modify: `web/components/document-upload-modal.tsx`
  Responsibility: maintain multi-file modal state, render selection summaries, submit batch FormData, and display upload results.

---

### Task 1: Extend the upload route for batch processing

**Files:**
- Modify: `web/app/api/projects/[projectId]/documents/upload/route.ts`
- Modify: `web/tests/api/task2-routes-hardening.test.ts`

- [ ] **Step 1: Write the failing route tests**

Add these tests to `web/tests/api/task2-routes-hardening.test.ts`:

```ts
  it("returns 400 when upload request contains no files", async () => {
    const { dir, dbPath } = makeTempDb();
    mockConfig(dbPath, path.join(dir, "uploads"));
    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    const { POST } = await import(
      "@/app/api/projects/[projectId]/documents/upload/route"
    );
    const response = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: new FormData(),
      }) as any,
      { params: Promise.resolve({ projectId: project.id }) },
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("No files were provided.");
    expect(json.uploaded).toEqual([]);
    expect(json.failed).toEqual([]);
  });

  it("supports partial success for batch uploads", async () => {
    const { dir, dbPath } = makeTempDb();
    mockConfig(dbPath, path.join(dir, "uploads"));
    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    const { POST } = await import(
      "@/app/api/projects/[projectId]/documents/upload/route"
    );
    const form = new FormData();
    form.append(
      "files",
      new File([Buffer.from("%PDF-1.7\\nvalid")], "alpha.pdf", {
        type: "application/pdf",
      }),
    );
    form.append(
      "files",
      new File([Buffer.from("not-a-pdf")], "broken.pdf", {
        type: "application/pdf",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: form,
      }) as any,
      { params: Promise.resolve({ projectId: project.id }) },
    );
    const json = await response.json();

    const db = new Database(dbPath, { readonly: true });
    const documents = db
      .prepare(`SELECT file_name FROM documents ORDER BY file_name ASC`)
      .all() as Array<{ file_name: string }>;
    const jobs = db.prepare(`SELECT COUNT(*) AS count FROM jobs`).get() as {
      count: number;
    };
    db.close();

    expect(response.status).toBe(201);
    expect(json.uploaded).toHaveLength(1);
    expect(json.uploaded[0].fileName).toBe("alpha.pdf");
    expect(json.failed).toEqual([
      {
        fileName: "broken.pdf",
        error: "Uploaded file is not a valid PDF.",
      },
    ]);
    expect(documents).toEqual([{ file_name: "alpha.pdf" }]);
    expect(jobs.count).toBe(1);
  });
```

- [ ] **Step 2: Run the route tests and verify they fail**

Run:

```bash
pnpm --dir web test tests/api/task2-routes-hardening.test.ts
```

Expected:

- FAIL because the route currently only reads one `file`
- FAIL because empty `FormData` does not return the new batch error payload

- [ ] **Step 3: Implement the minimal batch route support**

Update `web/app/api/projects/[projectId]/documents/upload/route.ts` to normalize request files and process them independently:

```ts
type UploadedItem = {
  documentId: string;
  fileName: string;
  status: string;
  jobId: string;
};

type FailedItem = {
  fileName: string;
  error: string;
};

function getFilesFromForm(form: FormData) {
  const batchFiles = form.getAll("files").filter((value): value is File => value instanceof File);
  if (batchFiles.length > 0) {
    return batchFiles;
  }

  const legacyFile = form.get("file");
  return legacyFile instanceof File ? [legacyFile] : [];
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = getProjectById(appConfig.dbPath, projectId, demoUserId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const form = await request.formData();
  const files = getFilesFromForm(form);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files were provided.", uploaded: [], failed: [] },
      { status: 400 },
    );
  }

  const uploaded: UploadedItem[] = [];
  const failed: FailedItem[] = [];

  for (const file of files) {
    if (file.type !== "application/pdf") {
      failed.push({ fileName: file.name || "unknown.pdf", error: "Only PDF uploads are supported." });
      continue;
    }
    if (!(await hasPdfSignature(file))) {
      failed.push({ fileName: file.name || "unknown.pdf", error: "Uploaded file is not a valid PDF." });
      continue;
    }

    let stored: { storagePath: string; fileSize: number };
    try {
      stored = await saveUploadedPdf(projectId, file);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        failed.push({ fileName: file.name || "unknown.pdf", error: error.message });
        continue;
      }
      failed.push({ fileName: file.name || "unknown.pdf", error: "Failed to save uploaded file." });
      continue;
    }

    const document = createDocumentRecord(appConfig.dbPath, {
      ownerUserId: demoUserId,
      projectId,
      fileName: file.name,
      storagePath: stored.storagePath,
      mimeType: file.type,
      fileSize: stored.fileSize,
    });
    const job = createIndexJob(appConfig.dbPath, document.id);

    uploaded.push({
      documentId: document.id,
      fileName: document.fileName,
      status: document.status,
      jobId: job.id,
    });
  }

  if (uploaded.length === 0) {
    return NextResponse.json({ uploaded, failed }, { status: 400 });
  }

  return NextResponse.json({ uploaded, failed }, { status: 201 });
}
```

- [ ] **Step 4: Run the route tests and verify they pass**

Run:

```bash
pnpm --dir web test tests/api/task2-routes-hardening.test.ts
```

Expected:

- PASS with the new empty-upload and partial-success cases green
- PASS with existing single-file route hardening coverage still green

- [ ] **Step 5: Commit the route work**

```bash
git add web/app/api/projects/[projectId]/documents/upload/route.ts web/tests/api/task2-routes-hardening.test.ts
git commit -m "feat: support bulk document upload batches"
```

---

### Task 2: Add multi-file upload modal behavior and tests

**Files:**
- Create: `web/tests/components/document-upload-modal.test.tsx`
- Modify: `web/components/document-upload-modal.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `web/tests/components/document-upload-modal.test.tsx` with this coverage:

```tsx
/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentUploadModal } from "@/components/document-upload-modal";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

afterEach(() => {
  routerMocks.refresh.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DocumentUploadModal", () => {
  it("shows file count and file names for multiple selected PDFs", async () => {
    const { container } = render(<DocumentUploadModal projectId="proj_1" />);

    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const alpha = new File([Buffer.from("%PDF-1.7\\nalpha")], "alpha.pdf", {
      type: "application/pdf",
    });
    const beta = new File([Buffer.from("%PDF-1.7\\nbeta")], "beta.pdf", {
      type: "application/pdf",
    });

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [alpha, beta],
    });
    fireEvent.change(input);

    expect(screen.getByText("2 files selected")).toBeInTheDocument();
    expect(screen.getByText("alpha.pdf")).toBeInTheDocument();
    expect(screen.getByText("beta.pdf")).toBeInTheDocument();
  });

  it("submits all selected files and shows partial failure details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        uploaded: [
          {
            documentId: "doc_1",
            fileName: "alpha.pdf",
            status: "uploaded",
            jobId: "job_1",
          },
        ],
        failed: [
          {
            fileName: "broken.pdf",
            error: "Uploaded file is not a valid PDF.",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<DocumentUploadModal projectId="proj_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const alpha = new File([Buffer.from("%PDF-1.7\\nalpha")], "alpha.pdf", {
      type: "application/pdf",
    });
    const broken = new File([Buffer.from("%PDF-1.7\\nbroken")], "broken.pdf", {
      type: "application/pdf",
    });

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [alpha, broken],
    });
    fireEvent.change(input);
    fireEvent.click(screen.getByRole("button", { name: "Upload PDFs" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = init.body as FormData;

    expect(body.getAll("files")).toHaveLength(2);
    expect(screen.getByText("1 uploaded, 1 failed")).toBeInTheDocument();
    expect(screen.getByText("broken.pdf")).toBeInTheDocument();
    expect(screen.getByText("Uploaded file is not a valid PDF.")).toBeInTheDocument();
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the component tests and verify they fail**

Run:

```bash
pnpm --dir web test tests/components/document-upload-modal.test.tsx
```

Expected:

- FAIL because the modal currently stores only one file
- FAIL because the submit button and UI copy are singular
- FAIL because partial-failure summary UI does not exist

- [ ] **Step 3: Implement the minimal multi-file modal**

Update `web/components/document-upload-modal.tsx` so the modal tracks multiple files and renders partial-failure details:

```tsx
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [resultSummary, setResultSummary] = useState<{
  uploaded: Array<{ fileName: string }>;
  failed: Array<{ fileName: string; error: string }>;
} | null>(null);

async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (selectedFiles.length === 0) return;

  setIsSubmitting(true);
  setErrorMessage(null);
  setResultSummary(null);

  const formData = new FormData();
  for (const file of selectedFiles) {
    formData.append("files", file);
  }

  try {
    const response = await fetch(`/api/projects/${projectId}/documents/upload`, {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          uploaded?: Array<{ fileName: string }>;
          failed?: Array<{ fileName: string; error: string }>;
        }
      | null;

    const uploaded = payload?.uploaded ?? [];
    const failed = payload?.failed ?? [];

    if (!response.ok && uploaded.length === 0) {
      setErrorMessage(payload?.error ?? "Upload failed. Try again.");
      setResultSummary({ uploaded, failed });
      return;
    }

    if (uploaded.length > 0) {
      router.refresh();
    }

    if (failed.length > 0) {
      setResultSummary({ uploaded, failed });
      setSelectedFiles([]);
      return;
    }

    setIsOpen(false);
    setSelectedFiles([]);
  } catch {
    setErrorMessage("Upload failed. Try again.");
  } finally {
    setIsSubmitting(false);
  }
}
```

Also update the rendered UI in `web/components/document-upload-modal.tsx`:

```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="application/pdf"
  multiple
  className="hidden"
  onChange={(event) => {
    setSelectedFiles(Array.from(event.target.files ?? []));
    setResultSummary(null);
  }}
/>

<p className="mt-3 text-xs text-[var(--pi-muted)]">
  {selectedFiles.length === 0 ? "No files selected" : `${selectedFiles.length} files selected`}
</p>
{selectedFiles.length > 0 ? (
  <ul className="mt-3 space-y-1 text-xs text-[var(--pi-ink)]">
    {selectedFiles.map((file) => (
      <li key={`${file.name}-${file.size}`}>{file.name}</li>
    ))}
  </ul>
) : null}

{resultSummary ? (
  <div className="mt-4 rounded-xl border border-[var(--pi-border)] bg-[rgba(13,20,32,0.65)] px-3 py-3 text-sm text-[var(--pi-ink)]">
    <p>{`${resultSummary.uploaded.length} uploaded, ${resultSummary.failed.length} failed`}</p>
    {resultSummary.failed.length > 0 ? (
      <ul className="mt-2 space-y-1 text-xs text-[rgba(255,201,212,0.95)]">
        {resultSummary.failed.map((item) => (
          <li key={`${item.fileName}-${item.error}`}>
            {item.fileName}: {item.error}
          </li>
        ))}
      </ul>
    ) : null}
  </div>
) : null}

<button
  type="submit"
  disabled={selectedFiles.length === 0 || isSubmitting}
  className="rounded-xl border border-[var(--pi-border-strong)] bg-[linear-gradient(140deg,rgba(64,126,255,0.9),rgba(53,98,206,0.86))] px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
>
  {isSubmitting ? "Uploading..." : "Upload PDFs"}
</button>
```

- [ ] **Step 4: Run the component tests and verify they pass**

Run:

```bash
pnpm --dir web test tests/components/document-upload-modal.test.tsx
```

Expected:

- PASS with multi-select summary behavior green
- PASS with batch FormData submission and partial-failure rendering green

- [ ] **Step 5: Commit the modal work**

```bash
git add web/components/document-upload-modal.tsx web/tests/components/document-upload-modal.test.tsx
git commit -m "feat: add bulk pdf upload modal flow"
```

---

### Task 3: Run bulk-upload verification and close the slice

**Files:**
- Modify: none

- [ ] **Step 1: Run the targeted verification suite**

Run:

```bash
pnpm --dir web test tests/api/task2-routes-hardening.test.ts tests/components/document-upload-modal.test.tsx
```

Expected:

- PASS with all batch-upload route and UI tests green

- [ ] **Step 2: Run the broader web regression suite**

Run:

```bash
pnpm --dir web test
```

Expected:

- PASS with the existing web test suite still green
- no new failures in chat, project detail, or storage-related tests

- [ ] **Step 3: Commit any final verification-only cleanup if needed**

```bash
git status --short
```

Expected:

- no unexpected generated files staged
- if no cleanup was needed, do not create an extra commit
