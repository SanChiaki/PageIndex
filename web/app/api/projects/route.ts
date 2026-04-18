import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { createProject, listProjects } from "@/lib/repos/project-store";

const schema = z.object({ name: z.string().min(1).max(120) });
const demoUserId = "user_demo";

export async function GET() {
  return NextResponse.json({ projects: listProjects(appConfig.dbPath, demoUserId) });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const project = createProject(appConfig.dbPath, {
    ownerUserId: demoUserId,
    name: parsed.data.name,
  });
  return NextResponse.json(project, { status: 201 });
}
