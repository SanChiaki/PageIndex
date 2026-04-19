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
  let sawUnexpectedStorageError = false;

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
      sawUnexpectedStorageError = true;
      failed.push({ fileName, error: "Failed to save uploaded file." });
      continue;
    }

    const document = createDocumentRecord(appConfig.dbPath, {
      ownerUserId: demoUserId,
      projectId,
      fileName: file.name,
      storagePath: stored.storagePath,
      mimeType: file.type,
      fileSize: stored.fileSize,
    });
    const job = createIndexJob(appConfig.dbPath, document.id);

    uploaded.push({
      documentId: document.id,
      fileName: document.fileName,
      status: document.status,
      jobId: job.id,
    });
  }

  if (uploaded.length === 0) {
    // Preserve prior semantics: unexpected storage errors remain 5xx.
    if (sawUnexpectedStorageError) {
      return NextResponse.json({ uploaded, failed }, { status: 500 });
    }
    return NextResponse.json({ uploaded, failed }, { status: 400 });
  }

  return NextResponse.json({ uploaded, failed }, { status: 201 });
}
