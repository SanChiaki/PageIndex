import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { createDocumentRecord } from "@/lib/repos/document-store";
import { createIndexJob } from "@/lib/repos/job-store";
import { saveUploadedPdf } from "@/lib/storage/local-files";

const demoUserId = "user_demo";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
  }

  const stored = await saveUploadedPdf(projectId, file);
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
