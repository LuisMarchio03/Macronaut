import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { criarWrapper } from "../../test/helpers/query-wrapper";
import { useRotinaAtiva, useCriarRotina, useDiasDaRotina, useSalvarDia } from "./use-rotina";

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
});

describe("use-rotina", () => {
  it("sem rotina, useRotinaAtiva responde null", async () => {
    const { result } = renderHook(() => useRotinaAtiva(), { wrapper: criarWrapper(db) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("criar a rotina invalida a consulta e ela reaparece", async () => {
    const wrapper = criarWrapper(db);
    const { result } = renderHook(
      () => ({ ativa: useRotinaAtiva(), criar: useCriarRotina() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.ativa.isSuccess).toBe(true));

    await result.current.criar.mutateAsync("Minha rotina");
    await waitFor(() => expect(result.current.ativa.data?.nome).toBe("Minha rotina"));
  });

  it("salvar um dia aparece na lista de dias", async () => {
    const wrapper = criarWrapper(db);
    const { result } = renderHook(
      () => {
        const ativa = useRotinaAtiva();
        return {
          ativa,
          criar: useCriarRotina(),
          dias: useDiasDaRotina(ativa.data),
          salvar: useSalvarDia(),
        };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.ativa.isSuccess).toBe(true));
    const rotina = await result.current.criar.mutateAsync("R");

    await result.current.salvar.mutateAsync({
      routineId: rotina.id, dia_semana: 1, nome: "Peito",
    });
    await waitFor(() => expect(result.current.dias.data?.[0]?.nome).toBe("Peito"));
  });
});
