import { it, expect, beforeEach, vi } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../test/helpers/test-db";
import { setAiFlags, setGeminiKey, listMessages } from "../src/repositories/ai";
import { handleChat, checkHealth, GatewayError, type ChatDeps } from "./ai-core";

let db: Client;
function deps(over: Partial<ChatDeps> = {}): ChatDeps {
  return {
    db,
    geminiModel: "m",
    newId: () => "uuid-fixo",
    hoje: () => "2026-07-09",
    buildContext: async () => "CTX",
    callGemini: vi.fn(async () => "resposta-gemini"),
    callAloy: vi.fn(async (_m, sid) => ({ message: "resposta-aloy", sessionId: sid ?? "aloy-sess", degraded: false })),
    ...over,
  };
}

beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: "INSERT INTO users (email,password_hash,created_at) VALUES ('a@x.com','h','2026-07-09')",
    args: [],
  });
});

it("provider desabilitado → GatewayError 403", async () => {
  await expect(handleChat(deps(), { userId: 1, provider: "gemini", message: "oi" }))
    .rejects.toMatchObject({ status: 403 });
});

it("gemini habilitado sem key → 400", async () => {
  await setAiFlags(db, "a@x.com", { gemini_enabled: true });
  await expect(handleChat(deps(), { userId: 1, provider: "gemini", message: "oi" }))
    .rejects.toBeInstanceOf(GatewayError);
});

it("gemini feliz: injeta contexto como system, persiste user+assistant, devolve sessionId novo", async () => {
  await setAiFlags(db, "a@x.com", { gemini_enabled: true });
  await setGeminiKey(db, 1, "k");
  const d = deps();
  const out = await handleChat(d, { userId: 1, provider: "gemini", message: "oi" });
  expect(out).toEqual({ message: "resposta-gemini", sessionId: "uuid-fixo", provider: "gemini", degraded: false });
  expect((d.callGemini as any).mock.calls[0][2]).toBe("CTX"); // systemText = contexto
  const msgs = await listMessages(db, 1, "gemini", "uuid-fixo");
  expect(msgs.map((m) => [m.role, m.content])).toEqual([["user", "oi"], ["assistant", "resposta-gemini"]]);
});

it("aloy feliz: prefixa contexto na message e usa o session_id devolvido", async () => {
  await setAiFlags(db, "a@x.com", { aloy_enabled: true });
  const d = deps();
  const out = await handleChat(d, { userId: 1, provider: "aloy", message: "oi" });
  expect(out.sessionId).toBe("aloy-sess");
  expect((d.callAloy as any).mock.calls[0][0]).toBe("CTX\n\noi");
  const msgs = await listMessages(db, 1, "aloy", "aloy-sess");
  expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
});

it("checkHealth: só reporta up para provider habilitado", async () => {
  await setAiFlags(db, "a@x.com", { aloy_enabled: true });
  const res = await checkHealth(
    { db, geminiModel: "m", geminiHealth: async () => true, aloyHealth: async () => ({ up: true }) },
    1,
  );
  expect(res.gemini.up).toBe(false); // gemini desabilitado
  expect(res.aloy.up).toBe(true);
});
