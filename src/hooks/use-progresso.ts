import { useQuery } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import {
  exerciciosComHistorico,
  seriesPorGrupo,
  sessoesComResumo,
} from "../repositories/progresso";

/** As três consultas de `/treino/progresso`. Só leitura — nada aqui escreve. */

export function useSessoesComResumo(limite = 50) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["progresso", "sessoes", userId, limite],
    queryFn: () => sessoesComResumo(db, userId, limite),
  });
}

export function useExerciciosComHistorico() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["progresso", "exercicios", userId],
    queryFn: () => exerciciosComHistorico(db, userId),
  });
}

export function useSeriesPorGrupo(inicio: string, fim: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["progresso", "grupos", userId, inicio, fim],
    queryFn: () => seriesPorGrupo(db, userId, inicio, fim),
  });
}
