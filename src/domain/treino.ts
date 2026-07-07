import type { ProgressoPonto } from "./types";

export function estimativaKcal(met: number, peso_kg: number, duracao_min: number): number {
  return met * peso_kg * (duracao_min / 60);
}

export function e1RM(peso_kg: number, reps: number): number {
  return peso_kg * (1 + reps / 30);
}

export function volumeSet(peso_kg: number, reps: number): number {
  return peso_kg * reps;
}

export function serieDeProgressao(
  sets: { data: string; peso_kg: number; reps: number }[],
): ProgressoPonto[] {
  const porData = new Map<string, { peso_kg: number; reps: number }[]>();
  for (const s of sets) {
    const arr = porData.get(s.data) ?? [];
    arr.push({ peso_kg: s.peso_kg, reps: s.reps });
    porData.set(s.data, arr);
  }
  const pontos: ProgressoPonto[] = [];
  for (const [data, ss] of porData) {
    pontos.push({
      data,
      topPeso: Math.max(...ss.map((s) => s.peso_kg)),
      e1RM: Math.round(Math.max(...ss.map((s) => e1RM(s.peso_kg, s.reps)))),
      volume: ss.reduce((acc, s) => acc + volumeSet(s.peso_kg, s.reps), 0),
    });
  }
  return pontos.sort((a, b) => a.data.localeCompare(b.data));
}
