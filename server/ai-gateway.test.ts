import { it, expect } from "vitest";
import { handleRequest, type RequestDeps } from "./ai-gateway";

const deps: RequestDeps = {
  authToken: "segredo",
  chat: async (input) => ({ message: "ok", sessionId: "s", provider: input.provider, degraded: false }),
  health: async (userId) => ({ gemini: { up: userId === 1 }, aloy: { up: false } }),
};
const auth = "Bearer segredo";

it("sem/errado Bearer → 401", async () => {
  const r = await handleRequest(deps, { method: "POST", path: "/ai/chat", query: new URLSearchParams(), authorization: "Bearer x", body: {} });
  expect(r.status).toBe(401);
});

it("POST /ai/chat válido → 200 com a saída do chat", async () => {
  const r = await handleRequest(deps, {
    method: "POST", path: "/ai/chat", query: new URLSearchParams(), authorization: auth,
    body: { userId: 1, provider: "aloy", message: "oi" },
  });
  expect(r.status).toBe(200);
  expect(r.json).toMatchObject({ message: "ok", provider: "aloy" });
});

it("POST /ai/chat com body inválido → 400", async () => {
  const r = await handleRequest(deps, {
    method: "POST", path: "/ai/chat", query: new URLSearchParams(), authorization: auth,
    body: { provider: "aloy" },
  });
  expect(r.status).toBe(400);
});

it("GET /ai/health?userId=1 → 200", async () => {
  const r = await handleRequest(deps, {
    method: "GET", path: "/ai/health", query: new URLSearchParams("userId=1"), authorization: auth, body: undefined,
  });
  expect(r.status).toBe(200);
  expect(r.json).toMatchObject({ gemini: { up: true } });
});

it("rota desconhecida → 404", async () => {
  const r = await handleRequest(deps, { method: "GET", path: "/x", query: new URLSearchParams(), authorization: auth, body: undefined });
  expect(r.status).toBe(404);
});

it("OPTIONS (preflight) → 204 com headers CORS, sem exigir Bearer", async () => {
  const r = await handleRequest(deps, {
    method: "OPTIONS", path: "/ai/chat", query: new URLSearchParams(), authorization: undefined, body: undefined,
  });
  expect(r.status).toBe(204);
  expect(r.headers?.["Access-Control-Allow-Origin"]).toBe("*");
  expect(r.headers?.["Access-Control-Allow-Methods"]).toMatch(/POST/);
  expect(r.headers?.["Access-Control-Allow-Headers"]).toMatch(/authorization/i);
});

it("OPTIONS (preflight) → libera Private Network Access", async () => {
  const r = await handleRequest(deps, {
    method: "OPTIONS", path: "/ai/health", query: new URLSearchParams(), authorization: undefined, body: undefined,
  });
  expect(r.headers?.["Access-Control-Allow-Private-Network"]).toBe("true");
});

it("toda resposta carrega Access-Control-Allow-Origin (browser cross-origin)", async () => {
  const ok = await handleRequest(deps, {
    method: "GET", path: "/ai/health", query: new URLSearchParams("userId=1"), authorization: auth, body: undefined,
  });
  expect(ok.headers?.["Access-Control-Allow-Origin"]).toBe("*");
  const naoAuth = await handleRequest(deps, {
    method: "POST", path: "/ai/chat", query: new URLSearchParams(), authorization: "Bearer x", body: {},
  });
  expect(naoAuth.status).toBe(401);
  expect(naoAuth.headers?.["Access-Control-Allow-Origin"]).toBe("*");
});
