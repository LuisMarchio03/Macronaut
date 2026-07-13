import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { handleChat, checkHealth, GatewayError, type ChatInput } from "./ai-core.ts";
import { buildUserContext } from "./context.ts";
import { callGemini, geminiHealth } from "./gemini.ts";
import { callAloy, aloyHealth } from "./aloy.ts";
import type { AiProvider } from "../src/repositories/ai.ts";

export type RequestDeps = {
  authToken: string;
  chat: (input: ChatInput) => Promise<{ message: string; sessionId: string; provider: AiProvider; degraded: boolean }>;
  health: (userId: number) => Promise<{ gemini: { up: boolean }; aloy: { up: boolean; detail?: string } }>;
};

function bearerOk(expected: string, authorization: string | undefined): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const got = Buffer.from(authorization.slice(7));
  const exp = Buffer.from(expected);
  return got.length === exp.length && timingSafeEqual(got, exp);
}

// O navegador (app em outra origem/porta) faz preflight CORS antes de POST com
// Authorization; sem estes headers a chamada é bloqueada e a UI só vê "não
// consegui conectar". Origem `*` é seguro aqui: a auth é por Bearer no header
// (nunca cookie), então não usamos credenciais de origem.
// O gateway vive num IP do Tailnet (100.64/10), que o Chrome classifica como rede
// privada. Sem este header o preflight vindo do app público (HTTPS na Vercel) é
// barrado por Private Network Access antes de qualquer resposta nossa.
export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Max-Age": "86400",
};

export async function handleRequest(
  deps: RequestDeps,
  req: { method: string; path: string; query: URLSearchParams; authorization: string | undefined; body: unknown },
): Promise<{ status: number; json: unknown; headers: Record<string, string> }> {
  // Preflight: responde antes de exigir Bearer (o browser não manda auth no OPTIONS).
  if (req.method === "OPTIONS") return { status: 204, json: null, headers: CORS };

  const res = await route(deps, req);
  return { ...res, headers: CORS };
}

async function route(
  deps: RequestDeps,
  req: { method: string; path: string; query: URLSearchParams; authorization: string | undefined; body: unknown },
): Promise<{ status: number; json: unknown }> {
  if (!bearerOk(deps.authToken, req.authorization)) return { status: 401, json: { error: "não autorizado" } };

  if (req.method === "POST" && req.path === "/ai/chat") {
    const b = req.body as Partial<ChatInput> | null;
    if (!b || typeof b.userId !== "number" || (b.provider !== "gemini" && b.provider !== "aloy") || typeof b.message !== "string" || !b.message) {
      return { status: 400, json: { error: "corpo inválido" } };
    }
    try {
      const out = await deps.chat({ userId: b.userId, provider: b.provider, message: b.message, sessionId: b.sessionId });
      return { status: 200, json: out };
    } catch (e) {
      if (e instanceof GatewayError) return { status: e.status, json: { error: e.message } };
      return { status: 500, json: { error: "erro interno" } };
    }
  }

  if (req.method === "GET" && req.path === "/ai/health") {
    const userId = Number(req.query.get("userId"));
    if (!Number.isInteger(userId) || userId <= 0) return { status: 400, json: { error: "userId inválido" } };
    return { status: 200, json: await deps.health(userId) };
  }

  return { status: 404, json: { error: "não encontrado" } };
}

// ── entrypoint (não roda nos testes; só quando executado direto) ─────────────
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return undefined;
  try { return JSON.parse(Buffer.concat(chunks).toString("utf-8")); } catch { return null; }
}

function main() {
  const dbUrl = process.env.DB_URL;
  const dbToken = process.env.DB_TOKEN;
  const aloyUrl = process.env.ALOY_URL ?? "http://127.0.0.1:8080";
  const aloyToken = process.env.ALOY_MACRONAUT_APP_TOKEN ?? "";
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const port = Number(process.env.PORT ?? 8787);
  if (!dbUrl || !dbToken) throw new Error("DB_URL e DB_TOKEN são obrigatórios");

  const db = createClient({ url: dbUrl, authToken: dbToken });
  const deps: RequestDeps = {
    authToken: dbToken,
    chat: (input) =>
      handleChat(
        {
          db, geminiModel, newId: randomUUID, hoje: () => new Date().toISOString().slice(0, 10),
          buildContext: buildUserContext, callGemini,
          callAloy: (message, sessionId) => callAloy(aloyUrl, aloyToken, message, sessionId),
        },
        input,
      ),
    health: (userId) =>
      checkHealth({ db, geminiModel, geminiHealth, aloyHealth: () => aloyHealth(aloyUrl, aloyToken) }, userId),
  };

  createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const body = req.method === "POST" ? await readBody(req) : undefined;
      const out = await handleRequest(deps, {
        method: req.method ?? "GET",
        path: url.pathname,
        query: url.searchParams,
        authorization: req.headers.authorization,
        body,
      });
      if (out.status === 204) {
        res.writeHead(204, out.headers);
        res.end();
        return;
      }
      res.writeHead(out.status, { "Content-Type": "application/json", ...out.headers });
      res.end(JSON.stringify(out.json));
    })().catch(() => {
      res.writeHead(500, { "Content-Type": "application/json", ...CORS });
      res.end(JSON.stringify({ error: "erro interno" }));
    });
  }).listen(port, () => console.log(`AI Gateway ouvindo em :${port}`));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
