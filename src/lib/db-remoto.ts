import type { Client, InStatement, ResultSet } from "@libsql/client/web";

/**
 * O banco visto pelo app, agora do outro lado de `/api/db`.
 *
 * O truque é a forma: os repositórios recebem `db: Client` e usam só
 * `execute` e `batch`. Trocar o transporte por baixo deles não exige tocar em
 * nenhum dos 422 `db.execute` do app — o que fez esta mudança caber num
 * arquivo em vez de numa reescrita.
 *
 * `executeMultiple`, `transaction` e `sync` não são implementados de
 * propósito: nenhum é usado pelo app (só por scripts e testes, que continuam
 * falando direto com o libsql). Se algum dia forem chamados aqui, explodem
 * dizendo isso, em vez de falhar em silêncio.
 */

interface ResultadoSerializado {
  columns: string[];
  rows: Record<string, unknown>[];
  rowsAffected: number;
  lastInsertRowid: string | null;
}

function naoImplementado(nome: string): never {
  throw new Error(
    `${nome} não existe através do proxy do banco. O app usa só execute e batch; ` +
      "scripts e testes falam direto com o libsql.",
  );
}

/** `string` ou `{sql, args}` — o libsql aceita os dois, e o app usa os dois. */
function normalizar(stmt: InStatement): { sql: string; args?: unknown } {
  if (typeof stmt === "string") return { sql: stmt };
  return { sql: stmt.sql, args: stmt.args };
}

/**
 * Reconstrói o `ResultSet` que os repositórios esperam.
 *
 * `lastInsertRowid` volta a ser `bigint`: meia dúzia de repositórios fazem
 * `Number(rs.lastInsertRowid)`, e o tipo do libsql promete `bigint` — devolver
 * string funcionaria por acidente do `Number`, e quebraria no dia em que
 * alguém comparasse com um `bigint`.
 */
function reidratar(r: ResultadoSerializado): ResultSet {
  return {
    columns: r.columns,
    columnTypes: [],
    rows: r.rows as unknown as ResultSet["rows"],
    rowsAffected: r.rowsAffected,
    lastInsertRowid: r.lastInsertRowid === null ? undefined : BigInt(r.lastInsertRowid),
    toJSON: () => r,
  } as ResultSet;
}

/**
 * A falha volta com a mensagem original do banco.
 *
 * `traduzirErro` reconhece "no such table" e "no such column" para dizer que o
 * banco está desatualizado, e `isAuthError` reconhece o 401 para deslogar.
 * Reembrulhar a causa numa mensagem genérica apagaria as duas coisas.
 */
async function erroDaResposta(res: Response): Promise<Error> {
  let detalhe = "";
  try {
    const b = (await res.json()) as { error?: string };
    detalhe = typeof b.error === "string" ? b.error : "";
  } catch {
    /* resposta sem JSON: sobra o status, que já diz bastante. */
  }
  return new Error(detalhe || `${res.status} ao falar com o banco`);
}

export function criarBancoRemoto(token: string, rota = "/api/db"): Client {
  async function pedir(corpo: unknown): Promise<unknown> {
    const res = await fetch(rota, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
    });
    if (!res.ok) throw await erroDaResposta(res);
    return (await res.json()) as unknown;
  }

  const cliente = {
    closed: false,
    protocol: "http" as const,

    async execute(stmt: InStatement): Promise<ResultSet> {
      const r = (await pedir({ tipo: "execute", comando: normalizar(stmt) })) as ResultadoSerializado;
      return reidratar(r);
    },

    async batch(stmts: InStatement[], mode?: string): Promise<ResultSet[]> {
      const r = (await pedir({
        tipo: "batch",
        comandos: stmts.map(normalizar),
        modo: mode,
      })) as ResultadoSerializado[];
      return r.map(reidratar);
    },

    executeMultiple: () => naoImplementado("executeMultiple"),
    transaction: () => naoImplementado("transaction"),
    sync: () => naoImplementado("sync"),
    // O app nunca fecha o banco: não há conexão para fechar, só `fetch`.
    close: () => {},
  };

  // O `Client` do libsql tem mais membros do que o app usa, e implementá-los
  // só para satisfazer o tipo seria código morto. O elenco é o contrato: o
  // que falta está acima, e explode com uma frase em vez de `undefined`.
  return cliente as unknown as Client;
}
