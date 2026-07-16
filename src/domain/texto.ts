/**
 * Minúsculas, sem acento, sem espaços nas pontas. Usa `\p{Diacritic}` (Unicode
 * property escape) em vez de uma faixa de code points combinantes hard-coded
 * (U+0300 a U+036F) — isso elimina a classe inteira do problema: escrever
 * essa faixa como caractere cru em vez de escape é invisível no editor e não
 * sobrevive a um reencode. Mordeu 4x nesta fase por causa disso.
 *
 * Helper único porque três cópias independentes (taco, exercises,
 * exercicio-autocomplete) eram exatamente por isso a razão da armadilha ser
 * recorrente: cada cópia era uma nova chance de o caractere cru entrar.
 */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
