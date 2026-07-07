import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { MemoryRouter } from "react-router-dom";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { AuthProvider } from "../lib/auth-context";
import { Onboarding } from "./onboarding";
import { getProfile } from "../repositories/profile";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}>
        <AuthProvider>
          <MemoryRouter><Onboarding /></MemoryRouter>
        </AuthProvider>
      </DbProvider>
    </QueryClientProvider>,
  );
}

it("calcula a sugestão e salva o perfil", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.type(screen.getByLabelText(/altura/i), "180");
  await user.type(screen.getByLabelText(/peso/i), "80");
  // userEvent.type não é confiável em <input type="date"> no jsdom (o input
  // espera digitação segmentada, não uma string solta). Definimos o valor
  // diretamente via fireEvent.change, mantendo as asserções do teste intactas.
  fireEvent.change(screen.getByLabelText(/nascimento/i), { target: { value: "1994-07-10" } });
  await user.click(screen.getByRole("button", { name: /calcular/i }));

  // sugestão apareceu num campo de meta (kcal > 0)
  const metaKcal = screen.getByLabelText(/meta.*kcal/i) as HTMLInputElement;
  await waitFor(() => expect(Number(metaKcal.value)).toBeGreaterThan(0));

  await user.click(screen.getByRole("button", { name: /salvar/i }));
  await waitFor(async () => expect(await getProfile(db)).not.toBeNull());
});
