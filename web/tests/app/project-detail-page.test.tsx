import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateDatabase } from "@/lib/db/migrate";

const tempDirs: string[] = [];
const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
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
  mocks.notFound.mockClear();
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
});
