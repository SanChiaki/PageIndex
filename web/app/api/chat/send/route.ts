import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig } from "@/lib/config";
import { sendRetrievalQuery } from "@/lib/retrieval-client";
import {
  appendConversationMessage,
  getConversationById,
  replaceConversationProjects,
  updateConversationTitle,
} from "@/lib/repos/conversation-store";
import { getProjectById } from "@/lib/repos/project-store";

const demoUserId = "user_demo";

const schema = z.object({
  conversationId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  message: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.projectIds.length === 0) {
    return NextResponse.json(
      { error: "At least one project must be selected." },
      { status: 400 },
    );
  }

  const conversation = getConversationById(
    appConfig.dbPath,
    parsed.data.conversationId,
    demoUserId,
  );
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const missingProjectIds = [...new Set(parsed.data.projectIds)].filter(
    (projectId) => !getProjectById(appConfig.dbPath, projectId, demoUserId),
  );
  if (missingProjectIds.length > 0) {
    return NextResponse.json(
      { error: "One or more projects were not found.", missingProjectIds },
      { status: 404 },
    );
  }

  replaceConversationProjects(
    appConfig.dbPath,
    parsed.data.conversationId,
    parsed.data.projectIds,
  );
  appendConversationMessage(appConfig.dbPath, {
    conversationId: parsed.data.conversationId,
    role: "user",
    content: parsed.data.message,
    citations: [],
  });
  if (conversation.title === "New Chat") {
    updateConversationTitle(
      appConfig.dbPath,
      parsed.data.conversationId,
      parsed.data.message.slice(0, 48),
    );
  }

  let result: Awaited<ReturnType<typeof sendRetrievalQuery>>;
  try {
    result = await sendRetrievalQuery({
      query: parsed.data.message,
      projectIds: parsed.data.projectIds,
    });
  } catch {
    result = {
      answer: "I ran into a retrieval error. Please try again.",
      citations: [],
      selectedDocuments: [],
    };
  }

  appendConversationMessage(appConfig.dbPath, {
    conversationId: parsed.data.conversationId,
    role: "assistant",
    content: result.answer,
    citations: result.citations,
  });

  return NextResponse.json(result);
}
