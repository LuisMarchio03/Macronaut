import { describe, it, expect } from "vitest";
import { authenticate, type LoginDeps, type StoredUser } from "./login-core";

const user: StoredUser = { id: 7, email: "a@x.com", password_hash: "HASH" };
const base: LoginDeps = {
  findUser: async (e) => (e === "a@x.com" ? user : null),
  verify: async (_senha, hash) => hash === "HASH",
  dummyHash: "DUMMY",
  session: { dbUrl: "libsql://compartilhado", token: "shared-token" },
};

describe("authenticate (banco único)", () => {
  it("credencial válida devolve user.id + dbUrl + token compartilhado", async () => {
    const r = await authenticate(base, { email: "a@x.com", senha: "ok" });
    expect(r).toEqual({
      ok: true,
      user: { id: 7, email: "a@x.com" },
      dbUrl: "libsql://compartilhado",
      token: "shared-token",
    });
  });

  it("e-mail inexistente → { ok: false }", async () => {
    const r = await authenticate(base, { email: "nao@existe.com", senha: "x" });
    expect(r).toEqual({ ok: false });
  });

  it("senha errada → { ok: false }", async () => {
    const deps = { ...base, verify: async () => false };
    const r = await authenticate(deps, { email: "a@x.com", senha: "errada" });
    expect(r).toEqual({ ok: false });
  });

  it("normaliza e-mail (trim + lowercase) antes de buscar", async () => {
    const r = await authenticate(base, { email: "  A@X.com  ", senha: "ok" });
    expect(r.ok).toBe(true);
  });

  it("roda verify mesmo sem usuário (anti-timing), com dummyHash", async () => {
    let usouDummy = false;
    const deps: LoginDeps = {
      ...base,
      findUser: async () => null,
      verify: async (_s, hash) => { if (hash === "DUMMY") usouDummy = true; return false; },
    };
    await authenticate(deps, { email: "nao@existe.com", senha: "x" });
    expect(usouDummy).toBe(true);
  });
});
