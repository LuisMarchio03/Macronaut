import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { setAiFlags, getGeminiKey } from "../repositories/ai";
import { DbProvider } from "../lib/db-context";
import { AuthProvider } from "../lib/auth-context";
import { Ajustes } from "./ajustes";

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock("../lib/auth-context", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/auth-context")>();
  return { ...real, useAuth: () => ({ logout, session: null, login: vi.fn() }) };
});

let db: Client;
beforeEach(async () => {
  logout.mockClear();
  db = await createTestDb();
  await db.execute({ sql: "INSERT INTO users (email,password_hash,created_at) VALUES ('a@x.com','h','2026-07-09')", args: [] });
});

function tela() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <DbProvider client={db} userId={1}>
          <MemoryRouter><Ajustes /></MemoryRouter>
        </DbProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

it("mostra o título Ajustes", async () => {
  tela();
  expect(await screen.findByText("Ajustes")).toBeInTheDocument();
});

it("o botão Sair chama logout", async () => {
  tela();
  const sair = await screen.findByRole("button", { name: /sair/i });
  await userEvent.click(sair);
  expect(logout).toHaveBeenCalledOnce();
});

it("sem flags: não mostra o campo da key", async () => {
  tela();
  await waitFor(() => expect(screen.getByText("Ajustes")).toBeInTheDocument());
  expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
});

it("gemini habilitado: salva a chave no banco", async () => {
  await setAiFlags(db, "a@x.com", { gemini_enabled: true });
  tela();
  const campo = await screen.findByLabelText(/api key/i);
  await userEvent.type(campo, "AIza-nova");
  await userEvent.click(screen.getByRole("button", { name: /salvar chave/i }));
  await waitFor(async () => expect(await getGeminiKey(db, 1)).toBe("AIza-nova"));
});

it("apenas gemini habilitado: existe o label da chave", async () => {
  await setAiFlags(db, "a@x.com", { gemini_enabled: true, aloy_enabled: false });
  tela();
  expect(await screen.findByLabelText(/api key/i)).toBeInTheDocument();
});