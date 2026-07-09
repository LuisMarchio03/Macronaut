import { it, expect, vi, afterEach } from "vitest";
import { callGemini, geminiHealth } from "./gemini";

afterEach(() => vi.unstubAllGlobals());

it("callGemini monta o payload e extrai o texto", async () => {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "resposta" }] } }] }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const out = await callGemini("k", "gemini-flash-latest", "sys", [{ role: "user", text: "oi" }]);
  expect(out).toBe("resposta");
  const [url, init] = fetchMock.mock.calls[0]! as unknown as [string | Request, RequestInit];
  expect(String(url)).toContain("gemini-flash-latest:generateContent?key=k");
  const body = JSON.parse(init.body as string);
  expect(body.systemInstruction.parts[0].text).toBe("sys");
  expect(body.contents[0]).toEqual({ role: "user", parts: [{ text: "oi" }] });
});

it("callGemini lança em erro HTTP", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 429 })));
  await expect(callGemini("k", "m", "s", [])).rejects.toThrow("gemini 429");
});

it("geminiHealth vira false em erro", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
  expect(await geminiHealth("k", "m")).toBe(false);
});
