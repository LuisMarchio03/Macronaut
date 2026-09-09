import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";
import type { RegistroCalistenia } from "../repositories/calistenia";

/** Quantos exercícios viram chip no card, e por quanto tempo para trás olhar
 *  para decidir o que virou hábito. */
export const CHIPS_NO_CARD = 6;
export const JANELA_DE_HABITO_DIAS = 30;

export function useSeriesDoDia(data: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["calistenia", "dia", data],
    queryFn: () => api["calistenia"].seriesDoDia(data),
  });
}

export function useSeriesPorRange(inicio: string, fim: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["calistenia", "range", inicio, fim],
    queryFn: () => api["calistenia"].seriesPorRange(inicio, fim),
  });
}

export function useExerciciosDeCalistenia() {
  const api = useApi();
  return useQuery({
    queryKey: ["calistenia", "exercicios"],
    queryFn: () => api["calistenia"].exerciciosDeCalistenia(),
  });
}

export function useUsadosRecentemente(desde: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["calistenia", "usados", desde],
    queryFn: () => api["calistenia"].usadosRecentemente(desde, CHIPS_NO_CARD),
  });
}

export function useMetasCalistenia() {
  const api = useApi();
  return useQuery({
    queryKey: ["calistenia", "metas"],
    queryFn: () => api["calistenia"].listarMetas(),
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
  const api = useApi();
  return useEscritaNaCalistenia((r: RegistroCalistenia) => api["calistenia"].registrarSerie(r));
}

export function useApagarSerieCalistenia() {
  const api = useApi();
  return useEscritaNaCalistenia((id: number) => api["calistenia"].apagarSerie(id));
}

export function useSalvarMetaCalistenia() {
  const api = useApi();
  return useEscritaNaCalistenia((v: { exerciseId: number; alvoDia: number }) =>
    api["calistenia"].salvarMeta(v.exerciseId, v.alvoDia),
  );
}

export function useApagarMetaCalistenia() {
  const api = useApi();
  return useEscritaNaCalistenia((exerciseId: number) => api["calistenia"].apagarMeta(exerciseId));
}
