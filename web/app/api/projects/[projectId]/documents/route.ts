import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { listDocumentsByProject } from "@/lib/repos/document-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return NextResponse.json({
    documents: listDocumentsByProject(appConfig.dbPath, projectId),
  });
}
