import { volumeSet } from "./treino";

export type SetAnalise = { data: string; reps: number; peso_kg: number; grupo: string | null };

export type ResumoTreino = {
  nSessoes: number;
  nSeries: number;
  volumeTotal: number;
  diasNoPeriodo: number;
};

export function resumoTreino(
  sets: SetAnalise[],
  nSessoes: number,
  diasNoPeriodo: number,
): ResumoTreino {
  let volumeTotal = 0;
  for (const s of sets) volumeTotal += volumeSet(s.peso_kg, s.reps);
  return { nSessoes, nSeries: sets.length, volumeTotal, diasNoPeriodo };
}

export function volumePorDia(sets: SetAnalise[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sets) m.set(s.data, (m.get(s.data) ?? 0) + volumeSet(s.peso_kg, s.reps));
  return m;
}

export function volumePorGrupo(sets: SetAnalise[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sets) {
    const g = s.grupo ?? "Sem grupo";
    m.set(g, (m.get(g) ?? 0) + volumeSet(s.peso_kg, s.reps));
  }
  return m;
}
