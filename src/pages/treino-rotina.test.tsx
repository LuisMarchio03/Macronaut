import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { TreinoRotina } from "./treino-rotina";
import { criarRotina, salvarDia, adicionarExercicio, listExercicios } from "../repositories/rotina";

let db: Client;

async function exercicio(nome: string): Promise<number> {
  const rs = await db.execute({
    sql: "INSERT INTO exercises (nome, source, created_at) VALUES (?, 'custom', ?)",
    args: [nome, new Date().toISOString()],
  });
  return Number(rs.lastInsertRowid);
}

function montar() {
  const Wrapper = criarWrapper(db);
  return render(
    <Wrapper>
      <MemoryRouter>
        <TreinoRotina />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("TreinoRotina", () => {
  it("sem rotina, convida a criar uma", async () => {
    montar();
    expect(await screen.findByRole("button", { name: /criar rotina/i })).toBeInTheDocument();
  });

  it("criada a rotina, lista os sete dias da semana", async () => {
    montar();
    await userEvent.click(await screen.findByRole("button", { name: /criar rotina/i }));
    for (const dia of ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]) {
      expect(await screen.findByText(dia)).toBeInTheDocument();
    }
  });

  it("um dia sem treino aparece como descanso", async () => {
    await criarRotina(db, 1, "R");
    montar();
    expect((await screen.findAllByText(/^descanso$/i)).length).toBe(7);
  });

  it("nomear um dia grava e o descanso some daquele dia", async () => {
    const r = await criarRotina(db, 1, "R");
    await salvarDia(db, 1, r.id, 1, "Peito e tríceps");
    montar();
    expect(await screen.findByText("Peito e tríceps")).toBeInTheDocument();
    expect((await screen.findAllByText(/^descanso$/i)).length).toBe(6);
  });

  it("mostra os exercícios do dia com séries, faixa de reps e carga", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, 1, "Peito");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Supino reto"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 40, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
    });
    montar();
    expect(await screen.findByText("Supino reto")).toBeInTheDocument();
    expect(await screen.findByText(/3 × 8–12 · 40 kg/)).toBeInTheDocument();
  });

  it("adicionar exercício grava com os padrões de dupla progressão", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, 1, "Peito");
    await exercicio("Supino reto");
    montar();

    await userEvent.click(
      await screen.findByRole("button", { name: /adicionar exercício em segunda/i }),
    );
    await userEvent.type(await screen.findByLabelText(/exercício/i), "Supino");
    await userEvent.click(await screen.findByRole("button", { name: /supino reto/i }));

    await waitFor(async () => {
      const lista = await listExercicios(db, 1, d.id);
      expect(lista).toHaveLength(1);
      expect(lista[0].prescricao).toBe("dupla");
      expect(lista[0].series).toBe(3);
      expect(lista[0].reps_min).toBe(8);
      expect(lista[0].reps_max).toBe(12);
      expect(lista[0].incremento_kg).toBe(2.5);
    });
  });

  it("o sheet de prescrição troca os campos ao escolher 5/3/1", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, 1, "Perna");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Agachamento"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 60, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /editar agachamento/i }));
    expect(await screen.findByLabelText(/peso de partida/i)).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: /método 5\/3\/1/i }));
    expect(await screen.findByLabelText(/training max/i)).toBeInTheDocument();
    // Pedir faixa de reps a quem escolheu 5/3/1 seria pedir um número que o
    // método já define.
    expect(screen.queryByLabelText(/peso de partida/i)).not.toBeInTheDocument();
  });

  it("salvar o sheet como 5/3/1 grava Training Max e parte do corpo", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, 1, "Perna");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Agachamento"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 60, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 90,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /editar agachamento/i }));
    await userEvent.click(await screen.findByRole("button", { name: /método 5\/3\/1/i }));
    await userEvent.type(await screen.findByLabelText(/training max/i), "120");
    await userEvent.click(await screen.findByRole("button", { name: /parte inferior/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^salvar$/i }));

    await waitFor(async () => {
      const [e] = await listExercicios(db, 1, d.id);
      expect(e.prescricao).toBe("531");
      expect(e.tm_kg).toBe(120);
      expect(e.parte).toBe("inferior");
    });
  });

  it("remove um exercício do dia", async () => {
    const r = await criarRotina(db, 1, "R");
    const d = await salvarDia(db, 1, r.id, 1, "Peito");
    await adicionarExercicio(db, 1, d.id, {
      exercise_id: await exercicio("Crucifixo"),
      prescricao: "dupla", series: 3, reps_min: 8, reps_max: 12,
      peso_kg: 12, incremento_kg: 2.5, tm_kg: null, parte: null, descanso_s: 60,
    });
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /remover crucifixo/i }));
    await waitFor(async () => expect(await listExercicios(db, 1, d.id)).toHaveLength(0));
  });
});
