import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  apagarMeta, apagarSerie, exerciciosDeCalistenia, listarMetas, registrarSerie,
  salvarMeta, seriesDoDia, seriesPorRange, usadosRecentemente,
  type RegistroCalistenia,
} from "../repositories/calistenia";

/** Quantos exercícios viram chip no card, e por quanto tempo para trás olhar
 *  para decidir o que virou hábito. */
export const CHIPS_NO_CARD = 6;
export const JANELA_DE_HABITO_DIAS = 30;

export function useSeriesDoDia(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "dia", data],
    queryFn: () => seriesDoDia(db, userId, data),
  });
}

export function useSeriesPorRange(inicio: string, fim: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "range", inicio, fim],
    queryFn: () => seriesPorRange(db, userId, inicio, fim),
  });
}

export function useExerciciosDeCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "exercicios"],
    queryFn: () => exerciciosDeCalistenia(db, userId),
  });
}

export function useUsadosRecentemente(desde: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "usados", desde],
    queryFn: () => usadosRecentemente(db, userId, desde, CHIPS_NO_CARD),
  });
}

export function useMetasCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["calistenia", "metas"],
    queryFn: () => listarMetas(db, userId),
  });
}

/**
 * Registrar uma série muda o dia, os chips e o gasto energético da análise.
 *
 * `analise` entra na invalidação porque a caloria da calistenia é somada ao
 * gasto na LEITURA — sem isto o balanço da `/analise` continuaria mostrando o
 * número de antes do registro, e duas telas contariam histórias diferentes
 * sobre o mesmo dia.
 */
function useEscritaNaCalistenia<TVars, TDados>(fn: (v: TVars) => Promise<TDados>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calistenia"] });
      qc.invalidateQueries({ queryKey: ["analise"] });
    },
  });
}

export function useRegistrarCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaCalistenia((r: RegistroCalistenia) => registrarSerie(db, userId, r));
}

export function useApagarSerieCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaCalistenia((id: number) => apagarSerie(db, userId, id));
}

export function useSalvarMetaCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaCalistenia((v: { exerciseId: number; alvoDia: number }) =>
    salvarMeta(db, userId, v.exerciseId, v.alvoDia),
  );
}

export function useApagarMetaCalistenia() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaCalistenia((exerciseId: number) => apagarMeta(db, userId, exerciseId));
}
