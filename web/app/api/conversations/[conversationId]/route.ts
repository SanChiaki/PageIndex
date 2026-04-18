import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getConversationDetail } from "@/lib/repos/conversation-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await context.params;
  return NextResponse.json(getConversationDetail(appConfig.dbPath, conversationId));
}
