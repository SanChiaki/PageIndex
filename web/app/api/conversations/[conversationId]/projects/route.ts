import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { replaceConversationProjects } from "@/lib/repos/conversation-store";

const schema = z.object({
  projectIds: z.array(z.string().min(1)),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const body = schema.parse(await request.json());
  replaceConversationProjects(appConfig.dbPath, conversationId, body.projectIds);
  return NextResponse.json({ ok: true });
}
