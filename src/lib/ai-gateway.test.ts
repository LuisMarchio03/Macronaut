import { it, expect, vi, afterEach } from "vitest";
import { postChat, getHealth } from "./ai-gateway";

afterEach(() => vi.unstubAllGlobals());

it("postChat manda Bearer e corpo, devolve a resposta", async () => {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ message: "oi", sessionId: "s", provider: "gemini", degraded: false }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const res = await postChat("tok", { userId: 1, provider: "gemini", message: "e aí" });
  expect(res.message).toBe("oi");
  const [, init] = (fetchMock.mock.calls as any)[0];
  expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
});

it("getHealth lança em não-2xx", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
  await expect(getHealth("tok", 1)).rejects.toThrow();
});
