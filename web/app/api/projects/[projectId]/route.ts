import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getProjectById } from "@/lib/repos/project-store";

const demoUserId = "user_demo";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const project = getProjectById(appConfig.dbPath, projectId, demoUserId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}
