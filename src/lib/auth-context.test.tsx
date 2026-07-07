import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./auth-context";
import { queryClient } from "./query-client";

function Tela() {
  const { session, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="email">{session?.email ?? "anon"}</span>
      <button onClick={() => login("ana@exemplo.com", "s3nha").catch(() => {})}>entrar</button>
      <button onClick={logout}>sair</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); });

it("login popula a sessão e persiste; logout limpa", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    user: { email: "ana@exemplo.com" }, dbUrl: "libsql://x", token: "tok", exp: Date.now() + 1_000_000,
  }), { status: 200 })));

  render(<AuthProvider><Tela /></AuthProvider>);
  expect(screen.getByTestId("email").textContent).toBe("anon");

  await userEvent.click(screen.getByText("entrar"));
  await waitFor(() => expect(screen.getByTestId("email").textContent).toBe("ana@exemplo.com"));
  expect(localStorage.getItem("macronaut.session")).toContain("ana@exemplo.com");

  await userEvent.click(screen.getByText("sair"));
  await waitFor(() => expect(screen.getByTestId("email").textContent).toBe("anon"));
  expect(localStorage.getItem("macronaut.session")).toBeNull();
});

it("logout limpa o cache do query client (isolamento entre usuários)", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    user: { email: "ana@exemplo.com" }, dbUrl: "libsql://x", token: "tok", exp: Date.now() + 1_000_000,
  }), { status: 200 })));
  const clearSpy = vi.spyOn(queryClient, "clear");

  render(<AuthProvider><Tela /></AuthProvider>);
  await userEvent.click(screen.getByText("entrar"));
  await waitFor(() => expect(screen.getByTestId("email").textContent).toBe("ana@exemplo.com"));
  await userEvent.click(screen.getByText("sair"));
  await waitFor(() => expect(screen.getByTestId("email").textContent).toBe("anon"));

  expect(clearSpy).toHaveBeenCalled();
  clearSpy.mockRestore();
});

it("login com 401 rejeita e não persiste sessão", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 401 })));
  render(<AuthProvider><Tela /></AuthProvider>);
  await userEvent.click(screen.getByText("entrar"));
  await waitFor(() => expect(localStorage.getItem("macronaut.session")).toBeNull());
  expect(screen.getByTestId("email").textContent).toBe("anon");
});
