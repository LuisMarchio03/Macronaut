import { it, expect } from "vitest";
import { isAuthError } from "./query-client";

it("reconhece erros de autenticação por mensagem", () => {
  expect(isAuthError(new Error("SERVER ERROR: 401 Unauthorized"))).toBe(true);
  expect(isAuthError(new Error("token expired"))).toBe(true);
  expect(isAuthError(new Error("authentication required"))).toBe(true);
});

it("ignora erros comuns", () => {
  expect(isAuthError(new Error("network timeout"))).toBe(false);
  expect(isAuthError("string qualquer")).toBe(false);
  expect(isAuthError(null)).toBe(false);
});
