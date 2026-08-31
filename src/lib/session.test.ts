import { it, expect, beforeEach } from "vitest";
import { loadSession, saveSession, clearSession, type Session } from "./session";

const s: Session = { userId: 1, email: "a@x.com", token: "tok" };
beforeEach(() => localStorage.clear());

it("salva e carrega de volta igual", () => {
  saveSession(s);
  expect(loadSession()).toEqual(s);
});

it("retorna null e limpa quando falta token", () => {
  saveSession({ ...s, token: "" });
  expect(loadSession()).toBeNull();
  expect(localStorage.getItem("macronaut.session")).toBeNull();
});

it("uma sessão do formato antigo (com dbUrl) é descartada", () => {
  // Aquela carregava o token do Turso. Aceitá-la seria manter viva a
  // credencial que este proxy veio tirar do navegador.
  localStorage.setItem(
    "macronaut.session",
    JSON.stringify({ userId: 1, email: "a@x.com", token: "tok-do-turso", dbUrl: "libsql://x" }),
  );
  expect(loadSession()).toBeNull();
  expect(localStorage.getItem("macronaut.session")).toBeNull();
});

it("retorna null e limpa quando userId não é numérico", () => {
  localStorage.setItem(
    "macronaut.session",
    JSON.stringify({ ...s, userId: "1" }),
  );
  expect(loadSession()).toBeNull();
  expect(localStorage.getItem("macronaut.session")).toBeNull();
});

it("retorna null quando não há sessão", () => {
  expect(loadSession()).toBeNull();
});

it("retorna null e limpa em JSON inválido", () => {
  localStorage.setItem("macronaut.session", "{lixo");
  expect(loadSession()).toBeNull();
  expect(localStorage.getItem("macronaut.session")).toBeNull();
});

it("clearSession remove a sessão", () => {
  saveSession(s);
  clearSession();
  expect(loadSession()).toBeNull();
});
