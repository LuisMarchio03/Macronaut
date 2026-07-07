import { it, expect, vi } from "vitest";
import { authenticate, type LoginDeps, type StoredUser } from "./login-core";

const user: StoredUser = {
  email: "ana@exemplo.com",
  password_hash: "hash-da-ana",
  db_name: "macro-ana",
  db_url: "libsql://macro-ana-org.turso.io",
};

function deps(over: Partial<LoginDeps> = {}): LoginDeps {
  return {
    findUser: async (e) => (e === "ana@exemplo.com" ? user : null),
    verify: async (_senha, hash) => hash === "hash-da-ana",
    mintToken: async () => ({ token: "tok", exp: 111 }),
    dummyHash: "dummy",
    ...over,
  };
}

it("normaliza o e-mail (trim + lowercase) antes de buscar", async () => {
  const findUser = vi.fn(deps().findUser);
  await authenticate(deps({ findUser }), { email: "  ANA@Exemplo.com ", senha: "x" });
  expect(findUser).toHaveBeenCalledWith("ana@exemplo.com");
});

it("credencial válida devolve token + dbUrl do usuário", async () => {
  const r = await authenticate(deps(), { email: "ana@exemplo.com", senha: "ok" });
  expect(r).toEqual({
    ok: true, user: { email: "ana@exemplo.com" },
    dbUrl: "libsql://macro-ana-org.turso.io", token: "tok", exp: 111,
  });
});

it("senha errada devolve ok:false", async () => {
  const r = await authenticate(deps({ verify: async () => false }), { email: "ana@exemplo.com", senha: "x" });
  expect(r).toEqual({ ok: false });
});

it("e-mail inexistente devolve ok:false E ainda chama verify (anti-timing)", async () => {
  const verify = vi.fn(async () => false);
  const r = await authenticate(deps({ verify }), { email: "ninguem@exemplo.com", senha: "x" });
  expect(r).toEqual({ ok: false });
  expect(verify).toHaveBeenCalledWith("x", "dummy");
});
