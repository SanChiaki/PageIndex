import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getDocumentPages } from "@/lib/repos/document-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const pages = request.nextUrl.searchParams.get("pages");
  try {
    return NextResponse.json({
      pages: getDocumentPages(appConfig.dbPath, documentId, pages),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid pages filter." },
      { status: 400 },
    );
  }
}
