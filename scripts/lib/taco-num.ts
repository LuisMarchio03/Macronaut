/**
 * "Tr" (traço), "*", "NA", "" → 0
 * Também protege contra ruído de arredondamento da fonte (carboidrato calculado
 * "por diferença" pode sair levemente negativo, ex.: -0.02, em alimentos com
 * carboidrato ~0 como carnes/peixes): valores negativos pequenos são grampeados em 0,
 * mas negativos grandes (erro real de dado) lançam erro em vez de serem mascarados.
 */
export function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  if (n < -0.5) throw new Error(`valor negativo suspeito na TACO: ${n}`);
  return Math.max(0, Math.round(n * 10) / 10);
}

/**
 * Como `num()`, mas distingue "não medido" de "zero".
 *
 * "Tr" (traço) → 0: traço é aproximadamente zero, e afirmar zero é honesto.
 * "NA" (não analisado) / vazio → null: ninguém mediu. Dizer 0 seria mentira.
 *
 * Medido na fonte real: 37% dos alimentos (221 de 597) têm fiber_g="NA". Com
 * `num()` todos eles alegariam 0 g de fibra, e o total diário do usuário seria
 * subestimado sem aviso. NULL vira "—" na tela e fica fora da soma — que é o
 * comportamento correto para dado ausente. Decisão do usuário, 2026-07-17.
 *
 * Só para fibra e sódio. Macros continuam em `num()`: a TACO sempre os mede.
 */
export function numOuNulo(v: unknown): number | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "" || s === "NA") return null;
  if (s === "TR") return 0;
  return num(v);
}
