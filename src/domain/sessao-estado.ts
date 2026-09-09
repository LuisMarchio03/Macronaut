/**
 * Onde a sessão está no seu ciclo de vida.
 *
 * Dois campos do banco codificam três estados, e esta é a ÚNICA leitura deles
 * no app. Antes de existir, `concluida_em` era consultado em quatro arquivos
 * com três interpretações diferentes do que ele significava.
 */
export type EstadoSessao = "rascunho" | "andamento" | "concluida";

/**
 * `concluida_em` decide primeiro, de propósito.
 *
 * Uma sessão concluída sem `iniciado_em` é impossível daqui para frente —
 * `finalizarSessao` preenche os dois. Mas ela existe em qualquer banco que
 * rodou este app antes da coluna existir e não passou pelo backfill, e
 * classificá-la como rascunho a esconderia do histórico: o dado some da tela
 * por causa de uma coluna nula. Terminado é terminado.
 */
export function estadoDaSessao(s: {
  iniciado_em: string | null;
  concluida_em: string | null;
}): EstadoSessao {
  if (s.concluida_em !== null) return "concluida";
  return s.iniciado_em !== null ? "andamento" : "rascunho";
}
