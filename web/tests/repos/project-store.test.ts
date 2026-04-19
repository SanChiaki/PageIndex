import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  createProject,
  getProjectById,
  listProjects,
  updateProjectName,
} from "@/lib/repos/project-store";
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
});
