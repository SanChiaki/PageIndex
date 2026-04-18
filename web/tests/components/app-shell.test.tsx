/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("reclaims desktop gutter space when the sidebar is collapsed", () => {
    render(
      <AppShell conversations={[]}>
        <div>Projects content</div>
      </AppShell>,
    );

    const main = screen.getByRole("main");
    expect(main.className).toContain("md:ml-[18.5rem]");

    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeInTheDocument();
    expect(main.className).toContain("md:ml-[6.75rem]");
  });
});
