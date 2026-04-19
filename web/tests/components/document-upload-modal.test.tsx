/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentUploadModal } from "@/components/document-upload-modal";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

afterEach(() => {
  routerMocks.refresh.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DocumentUploadModal", () => {
  it("shows file count and file names for multiple selected PDFs", async () => {
    const { container } = render(<DocumentUploadModal projectId="proj_1" />);

    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const alpha = new File([Buffer.from("%PDF-1.7\nalpha")], "alpha.pdf", {
      type: "application/pdf",
    });
    const beta = new File([Buffer.from("%PDF-1.7\nbeta")], "beta.pdf", {
      type: "application/pdf",
    });

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [alpha, beta],
    });
    fireEvent.change(input);

    expect(screen.getByText("2 files selected")).toBeInTheDocument();
    expect(screen.getByText("alpha.pdf")).toBeInTheDocument();
    expect(screen.getByText("beta.pdf")).toBeInTheDocument();
  });

  it("submits all selected files and shows partial failure details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        uploaded: [
          {
            documentId: "doc_1",
            fileName: "alpha.pdf",
            status: "uploaded",
            jobId: "job_1",
          },
        ],
        failed: [
          {
            fileName: "broken.pdf",
            error: "Uploaded file is not a valid PDF.",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<DocumentUploadModal projectId="proj_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const alpha = new File([Buffer.from("%PDF-1.7\nalpha")], "alpha.pdf", {
      type: "application/pdf",
    });
    const broken = new File([Buffer.from("%PDF-1.7\nbroken")], "broken.pdf", {
      type: "application/pdf",
    });

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [alpha, broken],
    });
    fireEvent.change(input);
    fireEvent.click(screen.getByRole("button", { name: "Upload PDFs" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = init.body as FormData;

    expect(body.getAll("files")).toHaveLength(2);
    expect(screen.getByText("1 uploaded, 1 failed")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === "LI" &&
          element.textContent === "broken.pdf: Uploaded file is not a valid PDF.",
      ),
    ).toBeInTheDocument();
    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Upload PDF")).toBeInTheDocument();
  });

  it("closes the modal after a full-success upload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        uploaded: [
          {
            documentId: "doc_1",
            fileName: "alpha.pdf",
            status: "uploaded",
            jobId: "job_1",
          },
        ],
        failed: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<DocumentUploadModal projectId="proj_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const alpha = new File([Buffer.from("%PDF-1.7\nalpha")], "alpha.pdf", {
      type: "application/pdf",
    });

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [alpha],
    });
    fireEvent.change(input);
    fireEvent.click(screen.getByRole("button", { name: "Upload PDFs" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(routerMocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Upload PDF")).not.toBeInTheDocument();
  });
});
