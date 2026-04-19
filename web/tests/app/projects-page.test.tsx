/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

afterEach(() => {
  vi.resetModules();
  vi.unmock("@/lib/config");
  vi.unmock("@/lib/repos/conversation-store");
  vi.unmock("@/lib/repos/project-store");
  vi.unmock("@/components/app-shell");
  routerMocks.refresh.mockClear();
  routerMocks.push.mockClear();
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
