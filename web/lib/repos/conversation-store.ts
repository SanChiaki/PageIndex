import crypto from "node:crypto";
import Database from "better-sqlite3";

function open(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}

export function createConversation(dbPath: string, ownerUserId: string) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  const row = {
    id: `conv_${crypto.randomUUID()}`,
    owner_user_id: ownerUserId,
    title: "New Chat",
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `INSERT INTO conversations (id, owner_user_id, title, created_at, updated_at)
     VALUES (@id, @owner_user_id, @title, @created_at, @updated_at)`,
  ).run(row);

  db.close();
  return { id: row.id, title: row.title };
}

export function listConversations(dbPath: string, ownerUserId: string) {
  const db = open(dbPath);
  const rows = db
    .prepare(
      `SELECT c.id,
              c.title,
              c.updated_at,
              COUNT(cp.project_id) AS project_count,
              MIN(p.name) AS first_project_name
         FROM conversations c
         LEFT JOIN conversation_projects cp
           ON cp.conversation_id = c.id
         LEFT JOIN projects p
           ON p.id = cp.project_id
        WHERE c.owner_user_id = ?
          AND c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.updated_at DESC`,
    )
    .all(ownerUserId) as Array<{
    id: string;
    title: string;
    updated_at: string;
    project_count: number;
    first_project_name: string | null;
  }>;

  db.close();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    scopeLabel:
      row.project_count === 0
        ? "No project"
        : row.project_count === 1
          ? row.first_project_name ?? "Unknown project"
          : "Multiple projects",
  }));
}

export function replaceConversationProjects(
  dbPath: string,
  conversationId: string,
  projectIds: string[],
) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO conversation_projects (conversation_id, project_id, created_at)
     VALUES (?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM conversation_projects WHERE conversation_id = ?`).run(
      conversationId,
    );

    for (const projectId of projectIds) {
      insert.run(conversationId, projectId, now);
    }
  });

  tx();
  db.close();
}

export function appendConversationMessage(
  dbPath: string,
  input: {
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    citations: unknown[];
  },
) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  const message = {
    id: `msg_${crypto.randomUUID()}`,
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    citations_json: JSON.stringify(input.citations),
    created_at: now,
  };

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO conversation_messages (
         id, conversation_id, role, content, citations_json, created_at
       ) VALUES (
         @id, @conversation_id, @role, @content, @citations_json, @created_at
       )`,
    ).run(message);

    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(
      now,
      input.conversationId,
    );
  });

  tx();
  db.close();
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    citations: input.citations,
    createdAt: message.created_at,
  };
}

export function updateConversationTitle(
  dbPath: string,
  conversationId: string,
  title: string,
) {
  const db = open(dbPath);
  const now = new Date().toISOString();
  db.prepare(`UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`).run(
    title.trim(),
    now,
    conversationId,
  );
  db.close();
}

export function getConversationDetail(dbPath: string, conversationId: string) {
  const db = open(dbPath);
  const conversation = db
    .prepare(
      `SELECT id, title, updated_at
         FROM conversations
        WHERE id = ?
          AND deleted_at IS NULL`,
    )
    .get(conversationId) as
    | { id: string; title: string; updated_at: string }
    | undefined;
  const projectRows = db
    .prepare(
      `SELECT cp.project_id, p.name
         FROM conversation_projects cp
         JOIN projects p ON p.id = cp.project_id
        WHERE cp.conversation_id = ?
        ORDER BY cp.created_at ASC`,
    )
    .all(conversationId) as Array<{ project_id: string; name: string }>;
  const messageRows = db
    .prepare(
      `SELECT id, role, content, citations_json, created_at
         FROM conversation_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC`,
    )
    .all(conversationId) as Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations_json: string;
    created_at: string;
  }>;

  db.close();
  return {
    id: conversation?.id ?? conversationId,
    title: conversation?.title ?? "New Chat",
    projectIds: projectRows.map((row) => row.project_id),
    projects: projectRows.map((row) => ({
      id: row.project_id,
      name: row.name,
    })),
    messages: messageRows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      citations: JSON.parse(row.citations_json),
      createdAt: row.created_at,
    })),
  };
}
