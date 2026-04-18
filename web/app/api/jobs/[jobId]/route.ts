import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getJob } from "@/lib/repos/job-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const job = getJob(appConfig.dbPath, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
