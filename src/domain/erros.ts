/**
 * Traduz a falha crua para uma frase que diz o que aconteceu e o que fazer.
 *
 * "SQLITE_ERROR: no such table: diet_plans" é a mensagem certa para quem lê
 * log e inútil para quem está com o celular na mão tentando importar a dieta.
 * A tradução é pura para poder ser testada sem navegador nem banco.
 */

export interface FalhaLegivel {
  /** O que aconteceu, em uma frase. */
  titulo: string;
  /** O que fazer a respeito. Vazio quando não há ação do usuário. */
  acao: string;
  /** Mensagem original, para o detalhe expansível. */
  original: string;
}

function mensagemDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}

const TABELA_FALTANDO = /no such table:?\s*([a-z_]+)/i;
const COLUNA_FALTANDO = /no such column:?\s*([a-z_.]+)/i;

export function traduzirErro(e: unknown): FalhaLegivel {
  const original = mensagemDe(e);

  const tabela = TABELA_FALTANDO.exec(original);
  if (tabela) {
    return {
      titulo: `O banco de dados está desatualizado: falta a tabela "${tabela[1]}".`,
      acao: "Rode `npm run db:setup` apontando para este banco e tente de novo.",
      original,
    };
  }

  const coluna = COLUNA_FALTANDO.exec(original);
  if (coluna) {
    return {
      titulo: `O banco de dados está desatualizado: falta a coluna "${coluna[1]}".`,
      acao: "Rode `npm run db:setup` apontando para este banco e tente de novo.",
      original,
    };
  }

  if (/\b401\b|unauthor|invalid token|expired/i.test(original)) {
    return {
      titulo: "Sua sessão expirou.",
      acao: "Entre de novo.",
      original,
    };
  }

  if (/\b403\b|forbidden/i.test(original)) {
    return {
      titulo: "O banco recusou a operação.",
      acao: "Confira se o token tem permissão de escrita neste banco.",
      original,
    };
  }

  if (/failed to fetch|networkerror|econnrefused|fetch failed|load failed/i.test(original)) {
    return {
      titulo: "Não consegui falar com o banco de dados.",
      acao: "Confira sua conexão e se o banco está no ar.",
      original,
    };
  }

  if (/\b5\d\d\b|server error|internal/i.test(original)) {
    return {
      titulo: "O banco de dados respondeu com erro.",
      acao: "Tente de novo em alguns instantes.",
      original,
    };
  }

  if (/constraint|unique|foreign key/i.test(original)) {
    return {
      titulo: "Esse registro conflita com um que já existe.",
      acao: "Confira os dados e tente de novo.",
      original,
    };
  }

  return {
    titulo: "Algo deu errado ao salvar.",
    acao: "Tente de novo. Se continuar, o detalhe abaixo ajuda a identificar a causa.",
    original,
  };
}
