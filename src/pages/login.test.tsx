import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../lib/auth-context";
import { Login } from "./login";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider><Login /></AuthProvider>
    </MemoryRouter>,
  );
}

it("mostra erro quando as credenciais são inválidas", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
  renderLogin();
  await userEvent.type(screen.getByLabelText(/e-mail/i), "ana@exemplo.com");
  await userEvent.type(screen.getByLabelText(/senha/i), "errada");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
  await waitFor(() => expect(screen.getByText(/inválidos/i)).toBeInTheDocument());
});

it("envia e-mail e senha para /api/login", async () => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({
    user: { email: "ana@exemplo.com" }, dbUrl: "libsql://x", token: "t", exp: Date.now() + 1_000_000,
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  renderLogin();
  await userEvent.type(screen.getByLabelText(/e-mail/i), "ana@exemplo.com");
  await userEvent.type(screen.getByLabelText(/senha/i), "s3nha");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
    email: "ana@exemplo.com", senha: "s3nha",
  });
});
