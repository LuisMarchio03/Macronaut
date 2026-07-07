import { it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../lib/auth-context";
import { saveSession } from "../lib/session";
import { RequireAuth } from "./require-auth";

// Evita instanciar o client libSQL/web de verdade no guard.
vi.mock("../lib/db", () => ({ createUserDb: () => ({}) }));

beforeEach(() => localStorage.clear());

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RequireAuth><div>área secreta</div></RequireAuth>} />
          <Route path="/login" element={<div>tela de login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

it("sem sessão, redireciona para /login", () => {
  renderApp();
  expect(screen.getByText("tela de login")).toBeInTheDocument();
});

it("com sessão válida, renderiza o conteúdo protegido", () => {
  saveSession({ email: "a@b.com", dbUrl: "libsql://x", token: "t", exp: Date.now() + 1_000_000 });
  renderApp();
  expect(screen.getByText("área secreta")).toBeInTheDocument();
});
