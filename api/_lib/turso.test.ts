import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDatabase, mintDbToken } from "./turso";

beforeEach(() => {
  vi.stubEnv("TURSO_ORG", "minha-org");
  vi.stubEnv("TURSO_PLATFORM_TOKEN", "plat-token");
  vi.stubEnv("TURSO_GROUP", "default");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("createDatabase posta na org e monta a URL libsql a partir do Hostname", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify({ database: { Hostname: "macro-ana-org.turso.io" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const out = await createDatabase("macro-ana");
  expect(out.dbUrl).toBe("libsql://macro-ana-org.turso.io");

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.turso.tech/v1/organizations/minha-org/databases");
  expect((init as RequestInit).method).toBe("POST");
  expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "macro-ana", group: "default" });
  expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer plat-token" });
});

it("mintDbToken aceita resposta com campo jwt", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jwt: "tok-jwt" }), { status: 200 })));
  expect(await mintDbToken("macro-ana", 7)).toBe("tok-jwt");
});

it("mintDbToken aceita resposta com campo token", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: "tok-plain" }), { status: 200 })));
  expect(await mintDbToken("macro-ana", 7)).toBe("tok-plain");
});

it("mintDbToken monta a query de expiração e acesso", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ jwt: "t" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await mintDbToken("macro-ana", 14);
  expect(fetchMock.mock.calls[0][0]).toBe(
    "https://api.turso.tech/v1/organizations/minha-org/databases/macro-ana/auth/tokens?expiration=14d&authorization=full-access",
  );
});

it("propaga erro HTTP", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
  await expect(createDatabase("x")).rejects.toThrow(/500/);
});
