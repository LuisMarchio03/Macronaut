export type Pesagem = { data: string; peso_kg: number };

export type ResumoPeso = {
  atual: number;
  inicial: number;
  variacao: number;
  media: number;
  min: number;
  max: number;
  nRegistros: number;
};

export function resumoPeso(pesagens: Pesagem[]): ResumoPeso {
  const n = pesagens.length;
  if (n === 0) return { atual: 0, inicial: 0, variacao: 0, media: 0, min: 0, max: 0, nRegistros: 0 };
  const pesos = pesagens.map((p) => p.peso_kg);
  const inicial = pesos[0];
  const atual = pesos[n - 1];
  return {
    atual,
    inicial,
    variacao: atual - inicial,
    media: pesos.reduce((a, b) => a + b, 0) / n,
    min: Math.min(...pesos),
    max: Math.max(...pesos),
    nRegistros: n,
  };
}
