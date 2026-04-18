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

describe("saveUploadedPdf", () => {
  it("rejects traversal-like project ids", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-files-"));
    tempDirs.push(dir);

    vi.doMock("@/lib/config", () => ({
      appConfig: {
        uploadRoot: path.join(dir, "uploads"),
      },
    }));

    const { saveUploadedPdf } = await import("@/lib/storage/local-files");
    const file = new File([Buffer.from("%PDF-1.7\n")], "safe.pdf", {
      type: "application/pdf",
    });

    await expect(saveUploadedPdf("../escape", file)).rejects.toThrow();
  });
});
