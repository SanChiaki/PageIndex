import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import {
  createConversation,
  listConversations,
  replaceConversationProjects,
} from "@/lib/repos/conversation-store";

const demoUserId = "user_demo";
const schema = z.object({
  projectIds: z.array(z.string()).default([]),
});

export async function GET() {
  return NextResponse.json({
    conversations: listConversations(appConfig.dbPath, demoUserId),
  });
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const conversation = createConversation(appConfig.dbPath, demoUserId);
  replaceConversationProjects(appConfig.dbPath, conversation.id, parsed.data.projectIds);
  return NextResponse.json(conversation, { status: 201 });
}
