import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

afterEach(() => {
  vi.resetModules();
  vi.unmock("@/lib/config");
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("saveUploadedDocument", () => {
  it("rejects traversal-like project ids", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-files-"));
    tempDirs.push(dir);

    vi.doMock("@/lib/config", () => ({
      appConfig: {
        uploadRoot: path.join(dir, "uploads"),
      },
    }));

    const { saveUploadedDocument } = await import("@/lib/storage/local-files");
    const file = new File([Buffer.from("%PDF-1.7\n")], "safe.pdf", {
      type: "application/pdf",
    });

    await expect(saveUploadedDocument("../escape", file)).rejects.toThrow();
  });

  it("preserves uploaded Office file extensions", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-files-"));
    tempDirs.push(dir);

    vi.doMock("@/lib/config", () => ({
      appConfig: {
        uploadRoot: path.join(dir, "uploads"),
      },
    }));

    const { saveUploadedDocument } = await import("@/lib/storage/local-files");
    const file = new File([Buffer.from("office bytes")], "Revenue Plan.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const stored = await saveUploadedDocument("proj_1", file);

    expect(stored.fileSize).toBe("office bytes".length);
    expect(path.basename(stored.storagePath)).toMatch(/Revenue_Plan\.xlsx$/);
    expect(fs.readFileSync(stored.storagePath, "utf8")).toBe("office bytes");
  });
});
