import { it, expect, beforeEach } from "vitest";
import { loadSession, saveSession, clearSession, type Session } from "./session";

const s: Session = { email: "a@b.com", dbUrl: "libsql://x", token: "tok", exp: 10_000 };
beforeEach(() => localStorage.clear());

it("salva e carrega quando não expirou", () => {
  saveSession(s);
  expect(loadSession(9_000)).toEqual(s);
});

it("retorna null e limpa quando expirou", () => {
  saveSession(s);
  expect(loadSession(10_001)).toBeNull();
  expect(localStorage.getItem("macronaut.session")).toBeNull();
});

it("retorna null quando não há sessão", () => {
  expect(loadSession(0)).toBeNull();
});

it("retorna null e limpa em JSON inválido", () => {
  localStorage.setItem("macronaut.session", "{lixo");
  expect(loadSession(0)).toBeNull();
  expect(localStorage.getItem("macronaut.session")).toBeNull();
});

it("clearSession remove a sessão", () => {
  saveSession(s);
  clearSession();
  expect(loadSession(0)).toBeNull();
});
