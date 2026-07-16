import { normalizar } from "./texto";

export type TacoItem = {
  nome: string;
  base_qty_g: number;
  kcal: number;
  prot_g: number;
  carb_g: number;
  gord_g: number;
};

export { normalizar };

export function buscarTaco(itens: TacoItem[], termo: string, limite = 8): TacoItem[] {
  const t = normalizar(termo);
  if (!t) return [];
  return itens
    .filter((it) => normalizar(it.nome).includes(t))
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .slice(0, limite);
}
