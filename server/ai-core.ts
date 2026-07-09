import type { Client } from "@libsql/client";
import {
  getAiConfig, getGeminiKey, listMessages, insertMessage, type AiProvider,
} from "../src/repositories/ai.ts";

export class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ChatInput = { userId: number; provider: AiProvider; message: string; sessionId?: string };
export type ChatOutput = { message: string; sessionId: string; provider: AiProvider; degraded: boolean };

export type ChatDeps = {
  db: Client;
  geminiModel: string;
  newId: () => string;
  hoje: () => string;
  buildContext: (db: Client, userId: number, data: string) => Promise<string>;
  callGemini: (
    apiKey: string, model: string, systemText: string,
    contents: { role: "user" | "model"; text: string }[],
  ) => Promise<string>;
  callAloy: (message: string, sessionId: string | undefined) => Promise<{ message: string; sessionId: string; degraded: boolean }>;
};

export async function handleChat(deps: ChatDeps, input: ChatInput): Promise<ChatOutput> {
  const cfg = await getAiConfig(deps.db, input.userId);
  if (input.provider === "gemini" && !cfg.gemini_enabled) throw new GatewayError(403, "gemini desabilitado");
  if (input.provider === "aloy" && !cfg.aloy_enabled) throw new GatewayError(403, "aloy desabilitado");

  const contexto = await deps.buildContext(deps.db, input.userId, deps.hoje());

  if (input.provider === "gemini") {
    const key = await getGeminiKey(deps.db, input.userId);
    if (!key) throw new GatewayError(400, "sem chave do Gemini");
    const sessionId = input.sessionId ?? deps.newId();
    await insertMessage(deps.db, { user_id: input.userId, provider: "gemini", session_id: sessionId, role: "user", content: input.message });
    const historico = await listMessages(deps.db, input.userId, "gemini", sessionId);
    const contents = historico.map((m) => ({ role: m.role === "assistant" ? "model" as const : "user" as const, text: m.content }));
    let texto: string;
    let degraded = false;
    try {
      texto = await deps.callGemini(key, deps.geminiModel, contexto, contents);
    } catch {
      texto = "Não consegui falar com o Gemini agora.";
      degraded = true;
    }
    await insertMessage(deps.db, { user_id: input.userId, provider: "gemini", session_id: sessionId, role: "assistant", content: texto });
    return { message: texto, sessionId, provider: "gemini", degraded };
  }

  // aloy
  const msg = `${contexto}\n\n${input.message}`;
  let resposta: { message: string; sessionId: string; degraded: boolean };
  try {
    resposta = await deps.callAloy(msg, input.sessionId);
  } catch {
    return {
      message: "Não consegui falar com a ALOY agora.",
      sessionId: input.sessionId ?? deps.newId(),
      provider: "aloy",
      degraded: true,
    };
  }
  await insertMessage(deps.db, { user_id: input.userId, provider: "aloy", session_id: resposta.sessionId, role: "user", content: input.message });
  await insertMessage(deps.db, { user_id: input.userId, provider: "aloy", session_id: resposta.sessionId, role: "assistant", content: resposta.message });
  return { message: resposta.message, sessionId: resposta.sessionId, provider: "aloy", degraded: resposta.degraded };
}

export type HealthResult = { gemini: { up: boolean }; aloy: { up: boolean; detail?: string } };
export type HealthDeps = {
  db: Client;
  geminiModel: string;
  geminiHealth: (apiKey: string, model: string) => Promise<boolean>;
  aloyHealth: () => Promise<{ up: boolean; detail?: string }>;
};

export async function checkHealth(deps: HealthDeps, userId: number): Promise<HealthResult> {
  const cfg = await getAiConfig(deps.db, userId);
  const key = await getGeminiKey(deps.db, userId);
  const geminiUp = cfg.gemini_enabled && key ? await deps.geminiHealth(key, deps.geminiModel) : false;
  const aloy = cfg.aloy_enabled ? await deps.aloyHealth() : { up: false };
  return { gemini: { up: geminiUp }, aloy };
}
