export type Balanco = { ingerido: number; gasto: number; saldo: number };

export function balancoEnergetico(
  kcalIngeridaPorDia: Map<string, number>,
  kcalGastaPorDia: Map<string, number>,
): Balanco {
  let ingerido = 0, gasto = 0;
  for (const v of kcalIngeridaPorDia.values()) ingerido += v;
  for (const v of kcalGastaPorDia.values()) gasto += v;
  return { ingerido, gasto, saldo: ingerido - gasto };
}
