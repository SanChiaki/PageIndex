/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectRenameControl } from "@/components/project-rename-control";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

afterEach(() => {
  routerMocks.refresh.mockClear();
  routerMocks.push.mockClear();
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

  it("reopens with the latest saved name after a successful rename", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    expect(screen.getByRole("textbox")).toHaveValue("Beta Launch");
  });

  it("syncs the editor value when the latest project name arrives via props", () => {
    const { rerender } = render(
      <ProjectRenameControl projectId="proj_1" initialName="Alpha" />,
    );

    rerender(<ProjectRenameControl projectId="proj_1" initialName="Beta Launch" />);

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    expect(screen.getByRole("textbox")).toHaveValue("Beta Launch");
  });

  it("shows the API error when renaming fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Project name already exists." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectRenameControl projectId="proj_1" initialName="Alpha" />);

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Beta Launch" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Project name already exists.")).toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("Beta Launch");
  });

  it("shows a generic error when renaming throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectRenameControl projectId="proj_1" initialName="Alpha" />);

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Beta Launch" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText("Unable to rename project. Please try again."),
    ).toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });
});
