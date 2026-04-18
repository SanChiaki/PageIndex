import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { createIndexJob } from "@/lib/repos/job-store";

export async function POST(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const job = createIndexJob(appConfig.dbPath, documentId);
  return NextResponse.json(job, { status: 202 });
}
