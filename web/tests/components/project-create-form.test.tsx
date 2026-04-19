/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectCreateForm } from "@/components/project-create-form";

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

describe("ProjectCreateForm", () => {
  it("requires a non-empty project name before submit", () => {
    render(<ProjectCreateForm />);

    expect(screen.getByRole("button", { name: /create project/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/enter project name/i), {
      target: { value: "Alpha" },
    });

    expect(screen.getByRole("button", { name: /create project/i })).toBeEnabled();
  });

  it("posts the trimmed project name and refreshes on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "proj_1", name: "Alpha" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectCreateForm />);

    fireEvent.change(screen.getByPlaceholderText(/enter project name/i), {
      target: { value: "  Alpha  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Alpha" }),
      }),
    );
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText(/enter project name/i)).toHaveValue("");
  });

  it("shows the API error when project creation fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Project name already exists." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectCreateForm />);

    fireEvent.change(screen.getByPlaceholderText(/enter project name/i), {
      target: { value: "Alpha" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Project name already exists.")).toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/enter project name/i)).toHaveValue("Alpha");
  });

  it("shows a generic error when project creation throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectCreateForm />);

    fireEvent.change(screen.getByPlaceholderText(/enter project name/i), {
      target: { value: "Alpha" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    expect(
      await screen.findByText("Unable to create project. Please try again."),
    ).toBeInTheDocument();
    expect(routerMocks.refresh).not.toHaveBeenCalled();
  });
});
