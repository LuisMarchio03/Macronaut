import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { findUserByEmail, insertUser } from "./users";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

describe("users repo", () => {
  it("insere e busca por e-mail", async () => {
    const u = await insertUser(db, { email: "a@x.com", password_hash: "scrypt$..." });
    expect(u.id).toBeGreaterThan(0);
    expect(u.created_at).toBeTruthy();
    const found = await findUserByEmail(db, "a@x.com");
    expect(found?.email).toBe("a@x.com");
    expect(found?.password_hash).toBe("scrypt$...");
  });

  it("devolve null para e-mail inexistente", async () => {
    expect(await findUserByEmail(db, "nao@existe.com")).toBeNull();
  });

  it("e-mail é único", async () => {
    await insertUser(db, { email: "a@x.com", password_hash: "h" });
    await expect(insertUser(db, { email: "a@x.com", password_hash: "h2" })).rejects.toThrow();
  });
});
