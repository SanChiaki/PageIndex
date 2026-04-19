import fs from "node:fs/promises";
import Database from "better-sqlite3";
import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { createDocumentRecord } from "@/lib/repos/document-store";
import { createIndexJob } from "@/lib/repos/job-store";
import { getProjectById } from "@/lib/repos/project-store";
import { saveUploadedPdf, UploadValidationError } from "@/lib/storage/local-files";

const demoUserId = "user_demo";

type UploadedItem = {
  documentId: string;
  fileName: string;
  status: string;
  jobId: string;
};

type FailedItem = {
  fileName: string;
  error: string;
};

async function hasPdfSignature(file: File) {
  const header = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("utf8");
  return header === "%PDF-";
}

async function removeStoredFile(storagePath: string) {
  await fs.rm(storagePath, { force: true });
}

function deleteDocumentArtifacts(documentId: string) {
  const db = new Database(appConfig.dbPath);
  db.pragma("foreign_keys = ON");

  try {
    db.prepare(`DELETE FROM jobs WHERE document_id = ?`).run(documentId);
    db.prepare(`DELETE FROM document_indexes WHERE document_id = ?`).run(documentId);
    db.prepare(`DELETE FROM documents WHERE id = ?`).run(documentId);
  } finally {
    db.close();
  }
}

function getFilesFromForm(form: FormData) {
  const batchFiles = form
    .getAll("files")
    .filter((value): value is File => value instanceof File);
  if (batchFiles.length > 0) {
    return batchFiles;
  }

  const legacyFile = form.get("file");
  return legacyFile instanceof File ? [legacyFile] : [];
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = getProjectById(appConfig.dbPath, projectId, demoUserId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const form = await request.formData();

  const files = getFilesFromForm(form);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files were provided.", uploaded: [], failed: [] },
      { status: 400 },
    );
  }

  const uploaded: UploadedItem[] = [];
  const failed: FailedItem[] = [];
  let sawUnexpectedServerError = false;

  for (const file of files) {
    const fileName = file.name || "unknown.pdf";

    if (file.type !== "application/pdf") {
      failed.push({ fileName, error: "Only PDF uploads are supported." });
      continue;
    }
    if (!(await hasPdfSignature(file))) {
      failed.push({ fileName, error: "Uploaded file is not a valid PDF." });
      continue;
    }

    let stored: { storagePath: string; fileSize: number };
    try {
      stored = await saveUploadedPdf(projectId, file);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        failed.push({ fileName, error: error.message });
        continue;
      }
      sawUnexpectedServerError = true;
      failed.push({ fileName, error: "Failed to save uploaded file." });
      continue;
    }

    let document;
    try {
      document = createDocumentRecord(appConfig.dbPath, {
        ownerUserId: demoUserId,
        projectId,
        fileName,
        storagePath: stored.storagePath,
        mimeType: file.type,
        fileSize: stored.fileSize,
      });
    } catch {
      sawUnexpectedServerError = true;
      await removeStoredFile(stored.storagePath).catch(() => undefined);
      failed.push({ fileName, error: "Failed to save document metadata." });
      continue;
    }

    let job;
    try {
      job = createIndexJob(appConfig.dbPath, document.id);
    } catch {
      sawUnexpectedServerError = true;
      deleteDocumentArtifacts(document.id);
      await removeStoredFile(stored.storagePath).catch(() => undefined);
      failed.push({ fileName, error: "Failed to queue document for indexing." });
      continue;
    }

    uploaded.push({
      documentId: document.id,
      fileName: document.fileName,
      status: document.status,
      jobId: job.id,
    });
  }

  if (uploaded.length === 0) {
    if (sawUnexpectedServerError) {
      return NextResponse.json(
        { error: "Upload processing failed.", uploaded, failed },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "All uploads failed.", uploaded, failed },
      { status: 400 },
    );
  }

  return NextResponse.json({ uploaded, failed }, { status: 201 });
}
