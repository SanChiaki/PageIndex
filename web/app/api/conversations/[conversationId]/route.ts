import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getConversationDetail } from "@/lib/repos/conversation-store";

const demoUserId = "user_demo";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  const conversation = getConversationDetail(appConfig.dbPath, conversationId, demoUserId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  return NextResponse.json(conversation);
}
