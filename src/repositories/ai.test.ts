import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  getAiConfig, getGeminiKey, setGeminiKey, setAiFlags, listMessages, insertMessage, getLatestSessionId,
} from "./ai";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
  await db.execute({
    sql: "INSERT INTO users (email, password_hash, created_at) VALUES (?, 'h', '2026-07-09')",
    args: ["a@x.com"],
  });
});

it("config default: tudo desligado, sem key", async () => {
  const c = await getAiConfig(db, 1);
  expect(c).toEqual({ aloy_enabled: false, gemini_enabled: false, has_gemini_key: false });
});

it("setAiFlags liga só o que foi passado; retorna false p/ e-mail inexistente", async () => {
  expect(await setAiFlags(db, "a@x.com", { gemini_enabled: true })).toBe(true);
  const c = await getAiConfig(db, 1);
  expect(c.gemini_enabled).toBe(true);
  expect(c.aloy_enabled).toBe(false);
  expect(await setAiFlags(db, "naoexiste@x.com", { aloy_enabled: true })).toBe(false);
});

it("get/set da key do Gemini e reflexo em has_gemini_key", async () => {
  expect(await getGeminiKey(db, 1)).toBeNull();
  await setGeminiKey(db, 1, "AIza-key");
  expect(await getGeminiKey(db, 1)).toBe("AIza-key");
  expect((await getAiConfig(db, 1)).has_gemini_key).toBe(true);
});

it("insere e lista mensagens por conversa, em ordem", async () => {
  await insertMessage(db, { user_id: 1, provider: "gemini", session_id: "s1", role: "user", content: "oi" });
  await insertMessage(db, { user_id: 1, provider: "gemini", session_id: "s1", role: "assistant", content: "olá" });
  await insertMessage(db, { user_id: 1, provider: "aloy", session_id: "s2", role: "user", content: "outra" });
  const conv = await listMessages(db, 1, "gemini", "s1");
  expect(conv.map((m) => m.content)).toEqual(["oi", "olá"]);
});

it("listMessages traz as N mais recentes, em ordem cronológica, quando a conversa excede o limite", async () => {
  for (let i = 1; i <= 25; i++) {
    await insertMessage(db, {
      user_id: 1,
      provider: "gemini",
      session_id: "s1",
      role: "user",
      content: `m${i}`,
    });
  }
  const conv = await listMessages(db, 1, "gemini", "s1");
  const contents = conv.map((m) => m.content);
  expect(contents).toHaveLength(20);
  expect(contents[0]).toBe("m6");
  expect(contents[contents.length - 1]).toBe("m25");
  expect(contents).toEqual(Array.from({ length: 20 }, (_, i) => `m${i + 6}`));
});

it("getLatestSessionId devolve a sessão da mensagem mais recente do provider", async () => {
  await insertMessage(db, { user_id: 1, provider: "gemini", session_id: "s1", role: "user", content: "a" });
  await insertMessage(db, { user_id: 1, provider: "gemini", session_id: "s2", role: "user", content: "b" });
  await insertMessage(db, { user_id: 1, provider: "aloy", session_id: "sx", role: "user", content: "c" });
  expect(await getLatestSessionId(db, 1, "gemini")).toBe("s2");
  expect(await getLatestSessionId(db, 1, "aloy")).toBe("sx");
});

it("getLatestSessionId devolve null sem mensagens do provider", async () => {
  expect(await getLatestSessionId(db, 1, "gemini")).toBeNull();
});
