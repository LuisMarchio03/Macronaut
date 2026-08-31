import { useQuery } from "@tanstack/react-query";
import { useApi, useUserId } from "../lib/db-context";

/** As três consultas de `/treino/progresso`. Só leitura — nada aqui escreve. */

export function useSessoesComResumo(limite = 50) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["progresso", "sessoes", userId, limite],
    queryFn: () => api["progresso"].sessoesComResumo(limite),
  });
}

export function useExerciciosComHistorico() {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["progresso", "exercicios", userId],
    queryFn: () => api["progresso"].exerciciosComHistorico(),
  });
}

export function useSeriesPorGrupo(inicio: string, fim: string) {
  const api = useApi();
  const userId = useUserId();
  return useQuery({
    queryKey: ["progresso", "grupos", userId, inicio, fim],
    queryFn: () => api["progresso"].seriesPorGrupo(inicio, fim),
  });
}
