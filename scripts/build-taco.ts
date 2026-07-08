// Uso: node --experimental-strip-types scripts/build-taco.ts
import { readFileSync, writeFileSync } from "node:fs";
import type { TacoItem } from "../src/domain/taco.ts";

// "Tr" (traço), "*", "NA", "" → 0
// Também protege contra ruído de arredondamento da fonte (carboidrato calculado
// "por diferença" pode sair levemente negativo, ex.: -0.02, em alimentos com
// carboidrato ~0 como carnes/peixes): valores negativos pequenos são grampeados em 0,
// mas negativos grandes (erro real de dado) lançam erro em vez de serem mascarados.
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  if (n < -0.5) throw new Error(`valor negativo suspeito na TACO: ${n}`);
  return Math.max(0, Math.round(n * 10) / 10);
}

// Fonte: marcelosanto/tabela_taco (TACO.json) — dados da Tabela Brasileira de
// Composição de Alimentos (TACO), 4ª ed., NEPA/UNICAMP. Chaves reais inspecionadas
// no Step 4 (energy_kcal já está em kcal, não kJ):
const MAPA = {
  nome: "description",
  kcal: "energy_kcal",
  prot: "protein_g",
  carb: "carbohydrate_g",
  gord: "lipid_g",
} as const;

const fonte = JSON.parse(readFileSync("scratchpad/taco-source.json", "utf8")) as Record<string, unknown>[];

const itens: TacoItem[] = fonte
  .map((r) => ({
    nome: String(r[MAPA.nome] ?? "").trim(),
    base_qty_g: 100,
    kcal: num(r[MAPA.kcal]),
    prot_g: num(r[MAPA.prot]),
    carb_g: num(r[MAPA.carb]),
    gord_g: num(r[MAPA.gord]),
  }))
  .filter((it) => it.nome.length > 0)
  .filter((it) => !(it.kcal === 0 && it.prot_g === 0 && it.carb_g === 0 && it.gord_g === 0));

writeFileSync("src/data/taco.json", JSON.stringify(itens, null, 0) + "\n");
console.log(`${itens.length} itens escritos em src/data/taco.json`);
