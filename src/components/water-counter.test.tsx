import { it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { WaterCounter } from "./water-counter";
import { getWaterTotal } from "../repositories/water";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

function renderCounter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider client={db}><WaterCounter data="2026-07-06" /></DbProvider>
    </QueryClientProvider>,
  );
}

it("adiciona um copo (250ml)", async () => {
  const user = userEvent.setup();
  renderCounter();
  await user.click(await screen.findByRole("button", { name: /\+ copo/i }));
  await waitFor(async () => expect(await getWaterTotal(db, "2026-07-06")).toBe(250));
});
