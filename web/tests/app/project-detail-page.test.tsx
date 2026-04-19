/** @vitest-environment jsdom */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateDatabase } from "@/lib/db/migrate";
import { createProject } from "@/lib/repos/project-store";

const tempDirs: string[] = [];
const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  router: {
    refresh: vi.fn(),
    push: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  useRouter: () => mocks.router,
}));

function makeTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-project-detail-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "app.db");
  migrateDatabase(dbPath);
  return { dbPath };
}

afterEach(() => {
  vi.resetModules();
  vi.unmock("@/lib/config");
  vi.unmock("@/components/app-shell");
  mocks.notFound.mockClear();
  mocks.router.refresh.mockClear();
  mocks.router.push.mockClear();
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("ProjectDetailPage", () => {
  it("calls notFound when the project does not exist", async () => {
    const { dbPath } = makeTempDb();

    vi.doMock("@/lib/config", () => ({
      appConfig: {
        dbPath,
        retrievalBaseUrl: "http://127.0.0.1:8001",
      },
    }));

    const module = await import("@/app/projects/[projectId]/page");

    await expect(
      module.default({
        params: Promise.resolve({ projectId: "proj_missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("renders when the project exists", async () => {
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

    await expect(
      module.default({
        params: Promise.resolve({ projectId: project.id }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });

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
    vi.doMock("@/components/app-shell", () => ({
      AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }));

    const module = await import("@/app/projects/[projectId]/page");
    const view = await module.default({
      params: Promise.resolve({ projectId: project.id }),
      searchParams: Promise.resolve({}),
    });

    render(view);

    expect(screen.getByRole("button", { name: /rename/i })).toBeInTheDocument();
  });
});
