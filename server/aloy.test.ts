import { it, expect, vi, afterEach, type Mock } from "vitest";
import { callAloy, aloyHealth } from "./aloy";

afterEach(() => vi.unstubAllGlobals());

it("callAloy envia Bearer + message/session_id e mapeia a resposta", async () => {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ message: "oi", session_id: "s9", degraded: false }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const out = await callAloy("http://127.0.0.1:8080", "tok", "ctx\n\noi", undefined);
  expect(out).toEqual({ message: "oi", sessionId: "s9", degraded: false });
  expect(fetchMock).toHaveBeenCalled();
  const calls = (fetchMock as Mock).mock.calls as Array<[string, RequestInit]>;
  const [url, init] = calls[0];
  expect(String(url)).toBe("http://127.0.0.1:8080/commands");
  expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
});

it("aloyHealth: 200 → up; erro de rede → down com detalhe", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  expect(await aloyHealth("http://x", "t")).toEqual({ up: true });
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
  expect(await aloyHealth("http://x", "t")).toEqual({ up: false, detail: "sem conexão" });
});
