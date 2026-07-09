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

// Mantém o real <AuthProvider> (o Ajustes só consome useAuth() para o logout),
// mas troca useAuth por um espião para continuar verificando o clique em "Sair".
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

it("mostra os 3 atalhos de config com os destinos certos", async () => {
  tela();
  await waitFor(() => expect(screen.getByText("Ajustes")).toBeInTheDocument());
  expect(screen.getByRole("link", { name: /alimentos/i })).toHaveAttribute("href", "/alimentos");
  expect(screen.getByRole("link", { name: /refeições/i })).toHaveAttribute("href", "/refeicoes");
  expect(screen.getByRole("link", { name: /metas/i })).toHaveAttribute("href", "/metas");
});

it("o botão Sair chama logout", async () => {
  tela();
  await userEvent.click(screen.getByRole("button", { name: /sair/i }));
  expect(logout).toHaveBeenCalledOnce();
});

it("sem flags: não mostra o card da IA nem o campo da key", async () => {
  tela();
  await waitFor(() => expect(screen.getByText("Ajustes")).toBeInTheDocument());
  expect(screen.queryByText(/assistente ia/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/chave do gemini/i)).not.toBeInTheDocument();
});

it("gemini habilitado: salva a chave no banco", async () => {
  await setAiFlags(db, "a@x.com", { gemini_enabled: true });
  tela();
  const campo = await screen.findByLabelText(/chave do gemini/i);
  await userEvent.type(campo, "AIza-nova");
  await userEvent.click(screen.getByRole("button", { name: /salvar chave/i }));
  await waitFor(async () => expect(await getGeminiKey(db, 1)).toBe("AIza-nova"));
});

it("apenas gemini habilitado: mostra o card da IA mas nunca revela a palavra aloy", async () => {
  await setAiFlags(db, "a@x.com", { gemini_enabled: true, aloy_enabled: false });
  tela();
  await screen.findByRole("link", { name: /assistente ia/i });
  expect(screen.queryByText(/aloy/i)).toBeNull();
});
