/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessageList } from "@/components/chat-message-list";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

afterEach(() => {
  routerMocks.push.mockClear();
  routerMocks.refresh.mockClear();
  vi.unmock("@/lib/config");
  vi.unmock("@/lib/repos/conversation-store");
  vi.unmock("@/lib/repos/project-store");
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Chat page components", () => {
  it("disables send when no project is selected", () => {
    render(
      <ChatComposer
        availableProjects={[
          { id: "proj_1", name: "Alpha" },
          { id: "proj_2", name: "Beta" },
        ]}
        selectedProjectIds={[]}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "How did revenue change?" },
    });

    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("creates a conversation before sending and then navigates to it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "conv_new" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "stub", citations: [], selectedDocuments: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ChatComposer
        availableProjects={[
          { id: "proj_1", name: "Alpha" },
          { id: "proj_2", name: "Beta" },
        ]}
        selectedProjectIds={["proj_1"]}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Summarize Alpha documents" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/conversations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ projectIds: ["proj_1"] }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/chat/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv_new",
          projectIds: ["proj_1"],
          message: "Summarize Alpha documents",
        }),
      }),
    );
    expect(routerMocks.push).toHaveBeenCalledWith("/chat?conversationId=conv_new");
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("renders citation details for assistant messages", () => {
    render(
      <ChatMessageList
        messages={[
          {
            id: "msg_1",
            role: "user",
            content: "What pages mention revenue?",
            citations: [],
          },
          {
            id: "msg_2",
            role: "assistant",
            content: "The revenue summary appears in two places.",
            citations: [
              {
                projectId: "proj_1",
                projectName: "Alpha",
                documentId: "doc_1",
                documentName: "Q1 Summary.pdf",
                pages: "2-3",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("The revenue summary appears in two places.")).toBeVisible();
    expect(
      screen.getByText(/\[Alpha\] Q1 Summary\.pdf - pages 2-3/i),
    ).toBeVisible();
  });

  it("falls back to an empty chat state when conversation is outside owner scope", async () => {
    const listConversations = vi.fn(() => [
      { id: "conv_1", title: "Quarterly review", scopeLabel: "Alpha" },
    ]);
    const getConversationDetail = vi.fn(() => null);
    const listProjects = vi.fn(() => [{ id: "proj_1", name: "Alpha" }]);

    vi.doMock("@/lib/config", () => ({
      appConfig: {
        dbPath: "/tmp/chat-page-test.db",
        retrievalBaseUrl: "http://127.0.0.1:8001",
      },
    }));
    vi.doMock("@/lib/repos/conversation-store", () => ({
      listConversations,
      getConversationDetail,
    }));
    vi.doMock("@/lib/repos/project-store", () => ({
      listProjects,
    }));
    vi.doMock("@/components/app-shell", () => ({
      AppShell: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="mock-shell">{children}</div>
      ),
    }));

    const module = await import("@/app/chat/page");
    const view = await module.default({
      searchParams: Promise.resolve({ conversationId: "conv_missing" }),
    });
    render(view);

    expect(screen.getByRole("heading", { name: /new chat/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /select one or more projects, then ask a question against indexed PDFs/i,
      ),
    ).toBeInTheDocument();
    expect(getConversationDetail).toHaveBeenCalledWith(
      "/tmp/chat-page-test.db",
      "conv_missing",
      "user_demo",
    );
  });

  it("renders the selected project scope in the chat header", async () => {
    const listConversations = vi.fn(() => [
      { id: "conv_1", title: "Quarterly review", scopeLabel: "Alpha" },
    ]);
    const getConversationDetail = vi.fn(() => ({
      id: "conv_1",
      title: "Quarterly review",
      projectIds: ["proj_1"],
      projects: [{ id: "proj_1", name: "Alpha" }],
      messages: [],
    }));
    const listProjects = vi.fn(() => [
      { id: "proj_1", name: "Alpha" },
      { id: "proj_2", name: "Beta" },
    ]);

    vi.doMock("@/lib/config", () => ({
      appConfig: {
        dbPath: "/tmp/chat-page-test.db",
        retrievalBaseUrl: "http://127.0.0.1:8001",
      },
    }));
    vi.doMock("@/lib/repos/conversation-store", () => ({
      listConversations,
      getConversationDetail,
    }));
    vi.doMock("@/lib/repos/project-store", () => ({
      listProjects,
    }));
    vi.doMock("@/components/app-shell", () => ({
      AppShell: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="mock-shell">{children}</div>
      ),
    }));

    const module = await import("@/app/chat/page");
    const view = await module.default({
      searchParams: Promise.resolve({ conversationId: "conv_1" }),
    });
    render(view);

    expect(screen.getByRole("heading", { name: /quarterly review/i })).toBeInTheDocument();
    expect(screen.getByText(/scope/i)).toBeInTheDocument();
    expect(screen.getByText("Alpha", { selector: "span" })).toBeInTheDocument();
  });
});
