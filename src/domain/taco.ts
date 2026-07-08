export type TacoItem = {
  nome: string;
  base_qty_g: number;
  kcal: number;
  prot_g: number;
  carb_g: number;
  gord_g: number;
};

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function buscarTaco(itens: TacoItem[], termo: string, limite = 8): TacoItem[] {
  const t = normalizar(termo);
  if (!t) return [];
  return itens
    .filter((it) => normalizar(it.nome).includes(t))
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .slice(0, limite);
}
