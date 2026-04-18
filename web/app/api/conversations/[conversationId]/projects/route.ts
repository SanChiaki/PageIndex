import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { replaceConversationProjects } from "@/lib/repos/conversation-store";

const schema = z.object({
  projectIds: z.array(z.string().min(1)),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: parsed.error.issues },
      { status: 400 },
    );
  }

  replaceConversationProjects(appConfig.dbPath, conversationId, parsed.data.projectIds);
  return NextResponse.json({ ok: true });
}
