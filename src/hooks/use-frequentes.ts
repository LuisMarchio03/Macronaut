import { useQuery } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { listEntriesByRange } from "../repositories/entries";
import { frequentesDaRefeicao, recentes, ultimaRefeicao } from "../domain/frequentes";

/** Formata Date → "YYYY-MM-DD" em UTC, igual ao resto do app. */
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Histórico recente. 60 dias é bastante para um ranking de hábito e mantém a
 * query barata — o app fala com o Turso por HTTP a cada leitura.
 */
export function useHistorico(dias = 60) {
  const db = useDb();
  const userId = useUserId();
  const fim = iso(new Date());
  const inicio = iso(new Date(Date.now() - dias * 86_400_000));
  return useQuery({
    queryKey: ["historico", inicio, fim],
    queryFn: () => listEntriesByRange(db, userId, inicio, fim),
  });
}

export function useFrequentes(mealId: number | null, dias = 60) {
  const { data: entries = [], isLoading } = useHistorico(dias);
  return {
    isLoading,
    frequentes: frequentesDaRefeicao(entries, mealId),
    recentes: recentes(entries),
    ultima: ultimaRefeicao(entries, mealId),
  };
}
