import type { ActivitySession } from "./types";

export type ResumoAtividade = {
  totalKcal: number;
  totalMin: number;
  nSessoes: number;
  mediaKcalDia: number;
  diasNoPeriodo: number;
};

export function resumoAtividade(
  sessions: ActivitySession[],
  diasNoPeriodo: number,
): ResumoAtividade {
  let totalKcal = 0, totalMin = 0;
  for (const s of sessions) {
    totalKcal += s.kcal;
    totalMin += s.duracao_min;
  }
  const div = diasNoPeriodo > 0 ? diasNoPeriodo : 1;
  return { totalKcal, totalMin, nSessoes: sessions.length, mediaKcalDia: totalKcal / div, diasNoPeriodo };
}

export function kcalGastaPorDia(sessions: ActivitySession[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) m.set(s.data, (m.get(s.data) ?? 0) + s.kcal);
  return m;
}
