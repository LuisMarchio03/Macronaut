import { it, expect } from "vitest";
import { hashPassword, verifyPassword, DUMMY_HASH } from "./auth";

it("aceita a senha correta (round-trip)", async () => {
  const h = await hashPassword("segredo123");
  expect(h.startsWith("scrypt$")).toBe(true);
  expect(await verifyPassword("segredo123", h)).toBe(true);
});

it("rejeita a senha errada", async () => {
  const h = await hashPassword("segredo123");
  expect(await verifyPassword("errada", h)).toBe(false);
});

it("hashes diferentes para a mesma senha (salt aleatório)", async () => {
  expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
});

it("retorna false para formato inválido", async () => {
  expect(await verifyPassword("x", "lixo")).toBe(false);
});

it("DUMMY_HASH é verificável (não dá early-return) e nunca casa", async () => {
  expect(await verifyPassword("qualquer", DUMMY_HASH)).toBe(false);
});
