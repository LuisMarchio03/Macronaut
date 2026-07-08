export type ResumoAgua = {
  mediaMl: number;
  totalMl: number;
  diasBateramMeta: number;
  diasRegistrados: number;
  diasNoPeriodo: number;
};

export function resumoAgua(
  mlPorDia: Map<string, number>,
  metaMl: number,
  diasNoPeriodo: number,
): ResumoAgua {
  let totalMl = 0, diasBateramMeta = 0, diasRegistrados = 0;
  for (const ml of mlPorDia.values()) {
    totalMl += ml;
    if (ml > 0) diasRegistrados++;
    if (metaMl > 0 && ml >= metaMl) diasBateramMeta++;
  }
  const div = diasNoPeriodo > 0 ? diasNoPeriodo : 1;
  return { mediaMl: totalMl / div, totalMl, diasBateramMeta, diasRegistrados, diasNoPeriodo };
}
