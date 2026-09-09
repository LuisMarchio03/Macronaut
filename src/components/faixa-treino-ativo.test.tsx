import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { sessaoEmCurso } from "../../test/helpers/sessao";
import { FaixaTreinoAtivo } from "./faixa-treino-ativo";
import { criarSessao, finalizarSessao } from "../repositories/sessao";
import { hoje } from "../lib/date";

const USER = 1;
let db: Client;

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <FaixaTreinoAtivo />
      </MemoryRouter>
    </Wrapper>,
  );
}

/** A faixa é assíncrona: sem nada para mostrar ela nunca renderiza um link. */
async function esperaOCiclo() {
  await new Promise((r) => setTimeout(r, 80));
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("FaixaTreinoAtivo", () => {
  it("sem treino aberto, não existe", async () => {
    montar();
    await esperaOCiclo();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("ignora rascunho: montado não é acontecendo", async () => {
    await criarSessao(db, USER, { data: hoje(), nome: "Rascunho da noite", itens: [] });
    montar();
    await esperaOCiclo();
    expect(screen.queryByText(/rascunho da noite/i)).not.toBeInTheDocument();
  });

  it("mostra o treino em andamento e leva de volta a ele", async () => {
    const sid = await sessaoEmCurso(db, USER, { data: hoje(), nome: "Peito e Tríceps", itens: [] });

    montar();

    const link = await screen.findByRole("link", { name: /peito e tríceps/i });
    expect(link).toHaveAttribute("href", `/treino/sessao?s=${sid}`);
  });

  it("o treino de ontem, ainda aberto, também aparece", async () => {
    await sessaoEmCurso(db, USER, { data: "2026-08-20", nome: "Costas", itens: [] });

    montar();

    expect(await screen.findByRole("link", { name: /costas/i })).toBeInTheDocument();
  });

  it("com dois treinos abertos, avisa que há mais um", async () => {
    await sessaoEmCurso(db, USER, { data: hoje(), nome: "Costas", itens: [] });
    await sessaoEmCurso(db, USER, { data: hoje(), nome: "Pernas", itens: [] });

    montar();

    expect(await screen.findByText("+1")).toBeInTheDocument();
  });

  it("some quando o treino é finalizado", async () => {
    const sid = await sessaoEmCurso(db, USER, { data: hoje(), nome: "Peito", itens: [] });
    await finalizarSessao(db, USER, sid);

    montar();
    await esperaOCiclo();
    expect(screen.queryByText(/peito/i)).not.toBeInTheDocument();
  });
});
