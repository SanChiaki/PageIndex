import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getDocumentStructure } from "@/lib/repos/document-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  return NextResponse.json({
    structure: getDocumentStructure(appConfig.dbPath, documentId),
  });
}
