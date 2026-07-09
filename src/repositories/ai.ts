import type { Client, Row } from "@libsql/client";

export type AiProvider = "gemini" | "aloy";

export type AiMessage = {
  id: number;
  user_id: number;
  provider: AiProvider;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function mapMsg(r: Row): AiMessage {
  return {
    id: r.id as number,
    user_id: r.user_id as number,
    provider: r.provider as AiProvider,
    session_id: r.session_id as string,
    role: r.role as AiMessage["role"],
    content: r.content as string,
    created_at: r.created_at as string,
  };
}

export async function getAiConfig(
  db: Client,
  userId: number,
): Promise<{ aloy_enabled: boolean; gemini_enabled: boolean; has_gemini_key: boolean }> {
  const rs = await db.execute({
    sql: `SELECT aloy_enabled, gemini_enabled,
                 (gemini_api_key IS NOT NULL AND gemini_api_key <> '') AS has_key
          FROM users WHERE id = ?`,
    args: [userId],
  });
  const r = rs.rows[0];
  if (!r) return { aloy_enabled: false, gemini_enabled: false, has_gemini_key: false };
  return {
    aloy_enabled: Number(r.aloy_enabled) === 1,
    gemini_enabled: Number(r.gemini_enabled) === 1,
    has_gemini_key: Number(r.has_key) === 1,
  };
}

export async function getGeminiKey(db: Client, userId: number): Promise<string | null> {
  const rs = await db.execute({ sql: "SELECT gemini_api_key FROM users WHERE id = ?", args: [userId] });
  const v = rs.rows[0]?.gemini_api_key as string | null | undefined;
  return v && v.length ? v : null;
}

export async function setGeminiKey(db: Client, userId: number, key: string): Promise<void> {
  await db.execute({ sql: "UPDATE users SET gemini_api_key = ? WHERE id = ?", args: [key, userId] });
}

export async function setAiFlags(
  db: Client,
  email: string,
  flags: { aloy_enabled?: boolean; gemini_enabled?: boolean },
): Promise<boolean> {
  const sets: string[] = [];
  const args: (number | string)[] = [];
  if (flags.aloy_enabled !== undefined) { sets.push("aloy_enabled = ?"); args.push(flags.aloy_enabled ? 1 : 0); }
  if (flags.gemini_enabled !== undefined) { sets.push("gemini_enabled = ?"); args.push(flags.gemini_enabled ? 1 : 0); }
  if (sets.length === 0) return true;
  args.push(email.trim().toLowerCase());
  const rs = await db.execute({ sql: `UPDATE users SET ${sets.join(", ")} WHERE email = ?`, args });
  return rs.rowsAffected > 0;
}

export async function listMessages(
  db: Client,
  userId: number,
  provider: AiProvider,
  sessionId: string,
  limite = 20,
): Promise<AiMessage[]> {
  const rs = await db.execute({
    sql: `SELECT * FROM (
            SELECT * FROM ai_messages
            WHERE user_id = ? AND provider = ? AND session_id = ?
            ORDER BY id DESC LIMIT ?
          ) ORDER BY id ASC`,
    args: [userId, provider, sessionId, limite],
  });
  return rs.rows.map(mapMsg);
}

export async function getLatestSessionId(
  db: Client,
  userId: number,
  provider: AiProvider,
): Promise<string | null> {
  const rs = await db.execute({
    sql: `SELECT session_id FROM ai_messages
          WHERE user_id = ? AND provider = ?
          ORDER BY id DESC LIMIT 1`,
    args: [userId, provider],
  });
  return rs.rows.length ? (rs.rows[0].session_id as string) : null;
}

export async function insertMessage(
  db: Client,
  m: Omit<AiMessage, "id" | "created_at">,
): Promise<AiMessage> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: `INSERT INTO ai_messages (user_id, provider, session_id, role, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [m.user_id, m.provider, m.session_id, m.role, m.content, created_at],
  });
  return { id: Number(rs.lastInsertRowid), created_at, ...m };
}
