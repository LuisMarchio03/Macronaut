import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { criarApiLocal } from "@/../test/helpers/api-local";
import { SheetAlimento } from "./sheet-alimento";
import { createFood } from "../repositories/foods";
import { createMeasure } from "../repositories/food-measures";
import type { Food } from "../domain/types";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

const base = {
  nome: "Pão francês", marca: null, base_qty_g: 100, base_unit: "g" as const,
  default_measure_id: null, kcal: 300, prot_g: 8, carb_g: 58, gord_g: 3,
  fibra_g: 2.3, sodio_mg: 580, categoria: "Cereais e derivados",
};

function montar(food: Food) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider api={criarApiLocal(db, 1)}>
        <SheetAlimento aberto food={food} onFechar={() => {}} onEditar={() => {}} onExcluir={() => {}} />
      </DbProvider>
    </QueryClientProvider>,
  );
}

describe("Ficha do alimento", () => {
  it("mostra os macros na base do alimento", async () => {
    const f = await createFood(db, base);
    montar(f);
    expect(await screen.findByText(/300/)).toBeInTheDocument();
    expect(screen.getByText(/Cereais e derivados/)).toBeInTheDocument();
    // Fibra e sódio estavam no banco e em lugar nenhum da tela.
    expect(screen.getByText(/2,3 g/)).toBeInTheDocument();
    expect(screen.getByText(/580 mg/)).toBeInTheDocument();
  });

  /**
   * O número que decide a porção não é "por 100 g" — é "quanto tem UMA
   * unidade". A medida caseira existia no banco e só aparecia no momento de
   * registrar, nunca na ficha.
   */
  it("mostra as medidas caseiras com o peso e a caloria de cada uma", async () => {
    const f = await createFood(db, base);
    await createMeasure(db, {
      food_id: f.id, nome: "unidade", qty_base: 50, ordem: 0,
      source: "manual", status: "confirmada", pof_codigo: null, pof_descricao: null,
    });
    montar(f);
    // `findBy`, não `getBy`: as medidas chegam por query assíncrona, e o
    // estado vazio ("unidade base") casa um /unidade/ solto antes disso.
    expect(await screen.findByText("1 unidade")).toBeInTheDocument();
    expect(await screen.findByText(/50 g · 150 kcal/)).toBeInTheDocument();
  });

  it("alimento da TACO não oferece editar nem excluir", async () => {
    const f = await createFood(db, base);
    montar({ ...f, source: "taco" });
    expect(await screen.findByText(/tabela TACO/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
  });

  it("alimento seu oferece editar e excluir", async () => {
    const f = await createFood(db, base);
    montar(f);
    expect(await screen.findByRole("button", { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /excluir/i })).toBeInTheDocument();
  });

  it("sem medida caseira, diz isso em vez de mostrar espaço vazio", async () => {
    const f = await createFood(db, base);
    montar(f);
    expect(await screen.findByText(/nenhuma medida caseira/i)).toBeInTheDocument();
  });
});
