import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { createProject, listProjects } from "@/lib/repos/project-store";

const schema = z.object({ name: z.string().min(1).max(120) });
const demoUserId = "user_demo";

export async function GET() {
  return NextResponse.json({ projects: listProjects(appConfig.dbPath, demoUserId) });
}

export async function POST(request: NextRequest) {
  const body = schema.parse(await request.json());
  const project = createProject(appConfig.dbPath, {
    ownerUserId: demoUserId,
    name: body.name,
  });
  return NextResponse.json(project, { status: 201 });
}
