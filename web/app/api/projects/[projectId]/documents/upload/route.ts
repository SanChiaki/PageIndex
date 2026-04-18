import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { createDocumentRecord } from "@/lib/repos/document-store";
import { createIndexJob } from "@/lib/repos/job-store";
import { getProjectById } from "@/lib/repos/project-store";
import { saveUploadedPdf } from "@/lib/storage/local-files";

const demoUserId = "user_demo";

async function hasPdfSignature(file: File) {
  const header = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("utf8");
  return header === "%PDF-";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = getProjectById(appConfig.dbPath, projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
  }
  if (!(await hasPdfSignature(file))) {
    return NextResponse.json({ error: "Uploaded file is not a valid PDF." }, { status: 400 });
  }

  let stored: { storagePath: string; fileSize: number };
  try {
    stored = await saveUploadedPdf(projectId, file);
  } catch {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
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

  return NextResponse.json(
    {
      uploaded: [
        {
          documentId: document.id,
          fileName: document.fileName,
          status: document.status,
          jobId: job.id,
        },
      ],
    },
    { status: 201 },
  );
}
