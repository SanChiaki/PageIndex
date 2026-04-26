import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  createProject,
  getProjectById,
  listProjects,
  updateProjectName,
} from "@/lib/repos/project-store";
import {
  createDocumentRecord,
  listDocumentsByProject,
  listDocumentIndexRuns,
} from "@/lib/repos/document-store";
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

  it("returns directory source metadata, latest index metrics, and run history", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-store-metrics-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.db");
    migrateDatabase(dbPath);

    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "ProjectA",
    });
    const document = createDocumentRecord(dbPath, {
      ownerUserId: "user_demo",
      projectId: project.id,
      fileName: "handover.md",
      storagePath: "/data/projects/ProjectA/delivery/handover.md",
      mimeType: "text/markdown",
      fileSize: 2048,
    });

    const db = new Database(dbPath);
    db.prepare(
      `UPDATE documents
          SET source_kind = 'directory',
              source_root = '/data/projects',
              source_relative_path = 'ProjectA/delivery/handover.md',
              project_relative_path = 'delivery/handover.md',
              content_hash = 'sha256:abc',
              source_mtime = '2026-04-25T10:00:00Z',
              source_size = 2048,
              media_type = 'markdown',
              import_status = 'imported',
              last_index_duration_ms = 1530,
              last_index_total_tokens = 4200,
              last_index_llm_call_count = 6,
              last_indexed_at = '2026-04-25T10:02:00Z'
        WHERE id = ?`,
    ).run(document.id);
    db.prepare(
      `INSERT INTO document_index_runs (
        id, document_id, job_id, status, started_at, finished_at,
        duration_ms, text_extraction_ms, pageindex_ms, vision_extraction_ms,
        persist_ms, llm_call_count, prompt_tokens, completion_tokens,
        total_tokens, token_source, models_json, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "run_1",
      document.id,
      null,
      "completed",
      "2026-04-25T10:00:00Z",
      "2026-04-25T10:02:00Z",
      1530,
      120,
      1300,
      0,
      110,
      6,
      3900,
      300,
      4200,
      "provider_usage",
      JSON.stringify({ "gpt-4.1": 6 }),
      null,
    );
    db.close();

    const [row] = listDocumentsByProject(dbPath, project.id);
    const runs = listDocumentIndexRuns(dbPath, document.id);

    expect(row).toMatchObject({
      id: document.id,
      fileName: "handover.md",
      sourceRelativePath: "ProjectA/delivery/handover.md",
      projectRelativePath: "delivery/handover.md",
      mediaType: "markdown",
      importStatus: "imported",
      lastIndexDurationMs: 1530,
      lastIndexTotalTokens: 4200,
      lastIndexLlmCallCount: 6,
      lastIndexedAt: "2026-04-25T10:02:00Z",
    });
    expect(runs).toEqual([
      {
        id: "run_1",
        status: "completed",
        startedAt: "2026-04-25T10:00:00Z",
        finishedAt: "2026-04-25T10:02:00Z",
        durationMs: 1530,
        textExtractionMs: 120,
        pageindexMs: 1300,
        visionExtractionMs: 0,
        persistMs: 110,
        llmCallCount: 6,
        promptTokens: 3900,
        completionTokens: 300,
        totalTokens: 4200,
        tokenSource: "provider_usage",
        models: { "gpt-4.1": 6 },
        errorMessage: null,
      },
    ]);
  });

  it("scopes project lookup to the owner when provided", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-store-owner-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.db");
    migrateDatabase(dbPath);

    const ownProject = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });
    const otherProject = createProject(dbPath, {
      ownerUserId: "user_other",
      name: "Beta",
    });

    expect(getProjectById(dbPath, ownProject.id, "user_demo")?.id).toBe(ownProject.id);
    expect(getProjectById(dbPath, otherProject.id, "user_demo")).toBeNull();
  });

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
    expect(getProjectById(dbPath, project.id, "user_demo")?.name).toBe(
      "Beta Launch",
    );
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

  it("rejects invalid project names in the repo layer", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-store-invalid-name-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.db");
    migrateDatabase(dbPath);

    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    expect(() =>
      createProject(dbPath, {
        ownerUserId: "user_demo",
        name: "   ",
      }),
    ).toThrow("Project name must be between 1 and 120 characters.");

    expect(() =>
      updateProjectName(dbPath, {
        ownerUserId: "user_demo",
        projectId: project.id,
        name: "x".repeat(121),
      }),
    ).toThrow("Project name must be between 1 and 120 characters.");
  });

  it("does not update the timestamp when a normalized rename is unchanged", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-store-rename-noop-"));
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
      name: "  Alpha  ",
    });

    expect(renamed?.name).toBe("Alpha");
    expect(renamed?.updatedAt).toBe(project.updatedAt);
  });
});
