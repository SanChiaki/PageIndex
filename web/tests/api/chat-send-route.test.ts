import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateDatabase } from "@/lib/db/migrate";
import { createConversation } from "@/lib/repos/conversation-store";
import { createProject } from "@/lib/repos/project-store";

const tempDirs: string[] = [];

function makeTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-chat-send-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "app.db");
  migrateDatabase(dbPath);
  return { dir, dbPath };
}

function mockConfig(dbPath: string) {
  vi.doMock("@/lib/config", () => ({
    appConfig: {
      dbPath,
      retrievalBaseUrl: "http://127.0.0.1:8001",
    },
  }));
}

afterEach(() => {
  vi.resetModules();
  vi.unmock("@/lib/config");
  vi.unmock("@/lib/retrieval-client");
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("chat send route validation", () => {
  it("returns 404 when conversation does not exist", async () => {
    const { dbPath } = makeTempDb();
    mockConfig(dbPath);
    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    const sendRetrievalQuery = vi.fn();
    vi.doMock("@/lib/retrieval-client", () => ({
      sendRetrievalQuery,
    }));

    const { POST } = await import("@/app/api/chat/send/route");
    const response = await POST(
      new Request("http://localhost/api/chat/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv_missing",
          projectIds: [project.id],
          message: "hello",
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toContain("Conversation");
    expect(sendRetrievalQuery).not.toHaveBeenCalled();
  });

  it("returns 404 when any submitted project is missing", async () => {
    const { dbPath } = makeTempDb();
    mockConfig(dbPath);
    const conversation = createConversation(dbPath, "user_demo");
    const project = createProject(dbPath, {
      ownerUserId: "user_demo",
      name: "Alpha",
    });

    const sendRetrievalQuery = vi.fn();
    vi.doMock("@/lib/retrieval-client", () => ({
      sendRetrievalQuery,
    }));

    const { POST } = await import("@/app/api/chat/send/route");
    const response = await POST(
      new Request("http://localhost/api/chat/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          projectIds: [project.id, "proj_missing"],
          message: "hello",
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toContain("project");
    expect(sendRetrievalQuery).not.toHaveBeenCalled();
  });
});
