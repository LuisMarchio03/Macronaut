import { it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { findUserByEmail, insertUser } from "./users";

let db: Client;
beforeEach(async () => { db = await createTestDb("auth-schema.sql"); });

const novo = {
  email: "ana@exemplo.com",
  password_hash: "scrypt$16384$8$1$c2FsdA==$aGFzaA==",
  db_name: "macronaut-ana-ab12cd",
  db_url: "libsql://macronaut-ana-ab12cd-org.turso.io",
};

it("retorna null quando o e-mail não existe", async () => {
  expect(await findUserByEmail(db, "ninguem@exemplo.com")).toBeNull();
});

it("insere e lê por e-mail", async () => {
  const salvo = await insertUser(db, novo);
  expect(salvo.id).toBeGreaterThan(0);
  const lido = await findUserByEmail(db, "ana@exemplo.com");
  expect(lido?.db_name).toBe("macronaut-ana-ab12cd");
  expect(lido?.password_hash).toBe(novo.password_hash);
});

it("rejeita e-mail duplicado (UNIQUE)", async () => {
  await insertUser(db, novo);
  await expect(insertUser(db, novo)).rejects.toThrow();
});
