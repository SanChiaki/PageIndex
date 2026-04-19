# Project Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require explicit names when creating projects, support renaming existing projects, and keep project-scoped chat flows working with the updated names.

**Architecture:** Extend the existing project store and `/api/projects` routes with an update path, then add two focused client-side controls: a create form on the projects page and an inline rename control on the project detail page. Rely on existing server-rendered project and chat pages to pick up renamed project data on refresh, then verify the full create -> rename -> upload -> chat workflow with CDP.

**Tech Stack:** Next.js App Router, React, TypeScript, better-sqlite3, Vitest, Testing Library, agent-browser CDP

---

## File Structure

- Modify: `web/lib/repos/project-store.ts`
  Responsibility: add owner-scoped project rename persistence with trimming and `updated_at` refresh.
- Modify: `web/tests/repos/project-store.test.ts`
  Responsibility: repository-level coverage for rename behavior.
- Modify: `web/app/api/projects/[projectId]/route.ts`
  Responsibility: add `PATCH` rename route beside existing `GET`.
- Modify: `web/tests/api/task2-routes-hardening.test.ts`
  Responsibility: route-level coverage for valid and invalid project rename requests.
- Create: `web/components/project-create-form.tsx`
  Responsibility: collect a required project name and submit project creation through `/api/projects`.
- Create: `web/components/project-rename-control.tsx`
  Responsibility: inline rename UI for the project detail header.
- Modify: `web/app/projects/page.tsx`
  Responsibility: replace generated-name server action button with the explicit create form.
- Modify: `web/app/projects/[projectId]/page.tsx`
  Responsibility: render rename control in the detail header.
- Create: `web/tests/components/project-create-form.test.tsx`
  Responsibility: verify required-name create flow behavior.
- Create: `web/tests/components/project-rename-control.test.tsx`
  Responsibility: verify rename edit/cancel/submit behavior.
- Create: `web/tests/app/projects-page.test.tsx`
  Responsibility: ensure the projects page renders the create-name form.
- Modify: `web/tests/app/project-detail-page.test.tsx`
  Responsibility: ensure the detail page renders the rename affordance.

---

### Task 1: Add project rename persistence and API support

**Files:**
- Modify: `web/lib/repos/project-store.ts`
- Modify: `web/tests/repos/project-store.test.ts`
- Modify: `web/app/api/projects/[projectId]/route.ts`
- Modify: `web/tests/api/task2-routes-hardening.test.ts`

- [ ] **Step 1: Write the failing repository tests**

Add these tests to `web/tests/repos/project-store.test.ts`:

```ts
  it("updates a project name for the owner and trims whitespace", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-store-rename-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.db");
    migrateDatabase(dbPath);

    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    const renamed = updateProjectName(dbPath, {
      ownerUserId: "user_demo",
      projectId: project.id,
      name: "  Beta Launch  ",
    });

    expect(renamed?.name).toBe("Beta Launch");
    expect(getProjectById(dbPath, project.id, "user_demo")?.name).toBe("Beta Launch");
  });

  it("returns null when renaming a project outside owner scope", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-store-rename-scope-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.db");
    migrateDatabase(dbPath);

    const project = createProject(dbPath, {
      ownerUserId: "user_other",
      name: "Gamma",
    });

    const renamed = updateProjectName(dbPath, {
      ownerUserId: "user_demo",
      projectId: project.id,
      name: "Delta",
    });

    expect(renamed).toBeNull();
    expect(getProjectById(dbPath, project.id, "user_other")?.name).toBe("Gamma");
  });
```

- [ ] **Step 2: Run the repository tests and verify they fail**

Run:

```bash
pnpm --dir web test tests/repos/project-store.test.ts
```

Expected:

- FAIL because `updateProjectName` does not exist yet

- [ ] **Step 3: Implement minimal repository rename support**

Add this helper to `web/lib/repos/project-store.ts`:

```ts
export function updateProjectName(
  dbPath: string,
  input: { ownerUserId: string; projectId: string; name: string },
) {
  const db = open(dbPath);
  const trimmedName = input.name.trim();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `UPDATE projects
          SET name = ?, updated_at = ?
        WHERE id = ?
          AND owner_user_id = ?
          AND deleted_at IS NULL`,
    )
    .run(trimmedName, now, input.projectId, input.ownerUserId);

  db.close();
  if (result.changes === 0) {
    return null;
  }

  return getProjectById(dbPath, input.projectId, input.ownerUserId);
}
```

- [ ] **Step 4: Run the repository tests and verify they pass**

Run:

```bash
pnpm --dir web test tests/repos/project-store.test.ts
```

Expected:

- PASS with the new rename cases green

- [ ] **Step 5: Write the failing API route tests**

Add these tests to `web/tests/api/task2-routes-hardening.test.ts`:

```ts
  it("renames a project through the detail route", async () => {
    const { dir, dbPath } = makeTempDb();
    mockConfig(dbPath, path.join(dir, "uploads"));
    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    const { PATCH } = await import("@/app/api/projects/[projectId]/route");
    const response = await PATCH(
      new Request(`http://localhost/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Beta Launch" }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.name).toBe("Beta Launch");
  });

  it("returns 400 for invalid rename payload", async () => {
    const { dir, dbPath } = makeTempDb();
    mockConfig(dbPath, path.join(dir, "uploads"));
    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    const { PATCH } = await import("@/app/api/projects/[projectId]/route");
    const response = await PATCH(
      new Request(`http://localhost/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when renaming a missing project", async () => {
    const { dir, dbPath } = makeTempDb();
    mockConfig(dbPath, path.join(dir, "uploads"));

    const { PATCH } = await import("@/app/api/projects/[projectId]/route");
    const response = await PATCH(
      new Request("http://localhost/api/projects/proj_missing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Beta Launch" }),
      }),
      { params: Promise.resolve({ projectId: "proj_missing" }) },
    );

    expect(response.status).toBe(404);
  });
```

- [ ] **Step 6: Run the API tests and verify they fail**

Run:

```bash
pnpm --dir web test tests/api/task2-routes-hardening.test.ts
```

Expected:

- FAIL because `PATCH /api/projects/[projectId]` is not implemented

- [ ] **Step 7: Implement the minimal `PATCH` route**

Update `web/app/api/projects/[projectId]/route.ts` to:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { getProjectById, updateProjectName } from "@/lib/repos/project-store";

const schema = z.object({ name: z.string().trim().min(1).max(120) });
const demoUserId = "user_demo";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const project = updateProjectName(appConfig.dbPath, {
    ownerUserId: demoUserId,
    projectId,
    name: parsed.data.name,
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}
```

- [ ] **Step 8: Run the API tests and verify they pass**

Run:

```bash
pnpm --dir web test tests/api/task2-routes-hardening.test.ts tests/repos/project-store.test.ts
```

Expected:

- PASS with repo and route rename coverage green

- [ ] **Step 9: Commit the persistence and API work**

```bash
git add web/lib/repos/project-store.ts web/tests/repos/project-store.test.ts web/app/api/projects/[projectId]/route.ts web/tests/api/task2-routes-hardening.test.ts
git commit -m "feat: add project rename api support"
```

---

### Task 2: Add required-name create and inline rename UI

**Files:**
- Create: `web/components/project-create-form.tsx`
- Create: `web/components/project-rename-control.tsx`
- Modify: `web/app/projects/page.tsx`
- Modify: `web/app/projects/[projectId]/page.tsx`
- Create: `web/tests/components/project-create-form.test.tsx`
- Create: `web/tests/components/project-rename-control.test.tsx`
- Create: `web/tests/app/projects-page.test.tsx`
- Modify: `web/tests/app/project-detail-page.test.tsx`

- [ ] **Step 1: Write the failing create-form component tests**

Create `web/tests/components/project-create-form.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectCreateForm } from "@/components/project-create-form";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

afterEach(() => {
  routerMocks.refresh.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ProjectCreateForm", () => {
  it("requires a non-empty project name before submit", () => {
    render(<ProjectCreateForm />);

    expect(screen.getByRole("button", { name: /create project/i })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/enter project name/i), {
      target: { value: "Alpha" },
    });
    expect(screen.getByRole("button", { name: /create project/i })).toBeEnabled();
  });

  it("posts the trimmed project name and refreshes on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "proj_1", name: "Alpha" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectCreateForm />);
    fireEvent.change(screen.getByPlaceholderText(/enter project name/i), {
      target: { value: "  Alpha  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Alpha" }),
      }),
    );
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText(/enter project name/i)).toHaveValue("");
  });
});
```

- [ ] **Step 2: Write the failing rename-control component tests**

Create `web/tests/components/project-rename-control.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectRenameControl } from "@/components/project-rename-control";

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

describe("ProjectRenameControl", () => {
  it("enters edit mode and cancels without saving", () => {
    render(<ProjectRenameControl projectId="proj_1" initialName="Alpha" />);

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(screen.getByDisplayValue("Alpha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByDisplayValue("Alpha")).not.toBeInTheDocument();
  });

  it("submits the trimmed renamed project name and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "proj_1", name: "Beta Launch" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectRenameControl projectId="proj_1" initialName="Alpha" />);
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    fireEvent.change(screen.getByDisplayValue("Alpha"), {
      target: { value: "  Beta Launch  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/proj_1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Beta Launch" }),
      }),
    );
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Write the failing page render tests**

Create `web/tests/app/projects-page.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unmock("@/lib/config");
  vi.unmock("@/lib/repos/conversation-store");
  vi.unmock("@/lib/repos/project-store");
});

describe("ProjectsPage", () => {
  it("renders the explicit create-name form", async () => {
    vi.doMock("@/lib/config", () => ({
      appConfig: { dbPath: "/tmp/test.db" },
    }));
    vi.doMock("@/lib/repos/conversation-store", () => ({
      listConversations: () => [],
    }));
    vi.doMock("@/lib/repos/project-store", () => ({
      listProjects: () => [],
    }));
    vi.doMock("@/components/app-shell", () => ({
      AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }));

    const module = await import("@/app/projects/page");
    render(await module.default({ searchParams: Promise.resolve({}) }));

    expect(screen.getByPlaceholderText(/enter project name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create project/i })).toBeInTheDocument();
  });
});
```

Extend `web/tests/app/project-detail-page.test.tsx`:

```ts
  it("renders the rename affordance when the project exists", async () => {
    const { dbPath } = makeTempDb();
    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    vi.doMock("@/lib/config", () => ({
      appConfig: {
        dbPath,
        retrievalBaseUrl: "http://127.0.0.1:8001",
      },
    }));

    const module = await import("@/app/projects/[projectId]/page");
    const view = await module.default({
      params: Promise.resolve({ projectId: project.id }),
      searchParams: Promise.resolve({}),
    });

    render(view);
    expect(screen.getByRole("button", { name: /rename/i })).toBeInTheDocument();
  });
```

- [ ] **Step 4: Run the new UI tests and verify they fail**

Run:

```bash
pnpm --dir web test tests/components/project-create-form.test.tsx tests/components/project-rename-control.test.tsx tests/app/projects-page.test.tsx tests/app/project-detail-page.test.tsx
```

Expected:

- FAIL because the create and rename components do not exist yet
- FAIL because the pages do not render the new controls

- [ ] **Step 5: Implement the create form**

Create `web/components/project-create-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const trimmedName = name.trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedName || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) return;

      setName("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Enter project name"
        maxLength={120}
        className="w-full min-w-[15rem] rounded-2xl border border-[var(--pi-border)] bg-[rgba(11,18,29,0.68)] px-4 py-2.5 text-sm text-[var(--pi-ink)] outline-none transition placeholder:text-[var(--pi-muted)] focus:border-[var(--pi-border-strong)] focus:ring-2 focus:ring-[var(--pi-brand-soft)]"
      />
      <button
        type="submit"
        disabled={!trimmedName || submitting}
        className="rounded-2xl border border-[var(--pi-border-strong)] bg-[linear-gradient(135deg,rgba(64,126,255,0.9),rgba(49,92,198,0.88))] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(52,112,255,0.28)] transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {submitting ? "Creating..." : "Create Project"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Implement the rename control**

Create `web/components/project-rename-control.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectRenameControl({
  projectId,
  initialName,
}: {
  projectId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const trimmedName = name.trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedName || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) return;

      setEditing(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-xl border border-[var(--pi-border)] px-3.5 py-2 text-sm text-[var(--pi-muted)] transition hover:border-[var(--pi-border-strong)] hover:text-[var(--pi-ink)]"
      >
        Rename
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={120}
        className="w-full min-w-[15rem] rounded-2xl border border-[var(--pi-border)] bg-[rgba(11,18,29,0.68)] px-4 py-2.5 text-sm text-[var(--pi-ink)] outline-none transition placeholder:text-[var(--pi-muted)] focus:border-[var(--pi-border-strong)] focus:ring-2 focus:ring-[var(--pi-brand-soft)]"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!trimmedName || submitting}
          className="rounded-xl border border-[var(--pi-border-strong)] bg-[linear-gradient(135deg,rgba(64,126,255,0.9),rgba(49,92,198,0.88))] px-3.5 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setName(initialName);
          }}
          className="rounded-xl border border-[var(--pi-border)] px-3.5 py-2 text-sm text-[var(--pi-muted)] transition hover:border-[var(--pi-border-strong)] hover:text-[var(--pi-ink)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 7: Wire the pages to the new controls**

Update `web/app/projects/page.tsx`:

```tsx
import { ProjectCreateForm } from "@/components/project-create-form";
```

Replace the old create server action form with:

```tsx
<ProjectCreateForm />
```

Update `web/app/projects/[projectId]/page.tsx`:

```tsx
import { ProjectRenameControl } from "@/components/project-rename-control";
```

Add the control next to the upload button:

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
  <ProjectRenameControl projectId={projectId} initialName={project.name} />
  <DocumentUploadModal projectId={projectId} />
</div>
```

- [ ] **Step 8: Run the UI tests and verify they pass**

Run:

```bash
pnpm --dir web test tests/components/project-create-form.test.tsx tests/components/project-rename-control.test.tsx tests/app/projects-page.test.tsx tests/app/project-detail-page.test.tsx
```

Expected:

- PASS with create-form, rename-control, and page render coverage green

- [ ] **Step 9: Commit the UI work**

```bash
git add web/components/project-create-form.tsx web/components/project-rename-control.tsx web/app/projects/page.tsx web/app/projects/[projectId]/page.tsx web/tests/components/project-create-form.test.tsx web/tests/components/project-rename-control.test.tsx web/tests/app/projects-page.test.tsx web/tests/app/project-detail-page.test.tsx
git commit -m "feat: add project naming controls"
```

---

### Task 3: Run verification and CDP end-to-end QA

**Files:**
- Modify: none

- [ ] **Step 1: Run the targeted automated tests**

Run:

```bash
pnpm --dir web test tests/repos/project-store.test.ts tests/api/task2-routes-hardening.test.ts tests/components/project-create-form.test.tsx tests/components/project-rename-control.test.tsx tests/app/projects-page.test.tsx tests/app/project-detail-page.test.tsx tests/components/chat-page.test.tsx
```

Expected:

- PASS with all project naming and chat-adjacent tests green

- [ ] **Step 2: Run the broader web regression suite**

Run:

```bash
pnpm --dir web test
```

Expected:

- PASS with no regressions in upload, chat, or project views

- [ ] **Step 3: Create a named project through the browser**

Run a CDP/browser session and:

```bash
agent-browser --session codex-project-naming open http://localhost:3000/projects
agent-browser --session codex-project-naming fill 'input[placeholder=\"Enter project name\"]' 'CDP Named Project'
agent-browser --session codex-project-naming click 'button:text(\"Create Project\")'
```

Expected:

- a project card named `CDP Named Project` appears

- [ ] **Step 4: Rename the project and verify detail page updates**

Continue the same browser session:

```bash
agent-browser --session codex-project-naming click 'a[aria-label=\"Open CDP Named Project\"]'
agent-browser --session codex-project-naming click 'button:text(\"Rename\")'
agent-browser --session codex-project-naming fill 'input[value=\"CDP Named Project\"]' 'CDP Renamed Project'
agent-browser --session codex-project-naming click 'button:text(\"Save\")'
```

Expected:

- project detail header and breadcrumb show `CDP Renamed Project`

- [ ] **Step 5: Upload documents and verify indexing status**

In the renamed project:

```bash
agent-browser --session codex-project-naming click 'button:text(\"Upload\")'
agent-browser --session codex-project-naming upload 'input[type=file]' '/Users/oam/Workspace/demos/PageIndexDemo/examples/documents/earthmover.pdf'
```

Expected:

- the document row appears in the project table
- indexing status moves through `Uploaded` / `Indexing` / eventual indexed state depending on background worker timing

- [ ] **Step 6: Open chat and verify the renamed project is selectable**

Continue the session:

```bash
agent-browser --session codex-project-naming open http://localhost:3000/chat
```

Expected:

- the project scope picker contains `CDP Renamed Project`

- [ ] **Step 7: Send a scoped chat query and verify retrieval/chat flow**

Use the renamed project in chat and send a simple retrieval prompt such as:

```text
Summarize the uploaded document and cite the relevant pages.
```

Expected:

- chat request succeeds
- conversation remains scoped to `CDP Renamed Project`
- assistant response renders citations or selected-document details without error

- [ ] **Step 8: Clean up any verification-only artifacts if needed**

Run:

```bash
git status --short
```

Expected:

- no unexpected generated files from tests or browser QA remain in the worktree
