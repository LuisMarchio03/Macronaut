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
 * É seguro juntar este comando com outros numa requisição só?
 *
 * Só leitura pura. Um `batch` do libsql é TRANSACIONAL: juntar escritas
 * independentes faria uma falhar e desfazer as outras, o que não acontecia
 * quando cada uma ia sozinha.
 *
 * A checagem é deliberadamente burra — começa com SELECT e não contém nenhuma
 * palavra de escrita. E não é a única defesa: o lote sai com `modo: "read"`,
 * que o próprio libsql recusa se houver escrita. O regex errar custa um erro
 * claro do banco, não uma escrita perdida.
 */
const ESCRITA = /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|BEGIN|COMMIT|VACUUM)\b/i;

function ehLeitura(sql: string): boolean {
  return /^\s*SELECT\b/i.test(sql) && !ESCRITA.test(sql);
}

/** O teto que o servidor aceita num lote. */
const LIMITE_LOTE = 200;

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

interface Pendente {
  comando: { sql: string; args?: unknown };
  resolver: (r: ResultSet) => void;
  rejeitar: (e: unknown) => void;
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

  /* ── junção das leituras ──────────────────────────────────────────
     Abrir o dashboard disparava 16 requisições: cada hook do TanStack Query
     chama `execute` uma vez, e cada `execute` era uma ida ao servidor, que
     fazia outra ida ao Turso. As 16 saem no MESMO tique do laço de eventos —
     é só isso que esta fila explora.

     `setTimeout(0)` e não `queueMicrotask`: um macrotarefa recolhe tudo o que
     a renderização enfileirou, microtarefas incluídas. Uma consulta que
     depende do resultado da anterior cai noutro tique e não é juntada — que é
     o certo, porque ela de fato precisa esperar.                          */
  let fila: Pendente[] = [];
  let agendado = false;

  function agendar() {
    if (agendado) return;
    agendado = true;
    setTimeout(() => {
      agendado = false;
      const lote = fila;
      fila = [];
      void despachar(lote);
    }, 0);
  }

  async function despachar(lote: Pendente[]): Promise<void> {
    if (lote.length === 0) return;
    if (lote.length === 1) return void executarSozinho(lote[0]);
    // Acima do teto do servidor, quebra em pedaços em vez de levar 400.
    if (lote.length > LIMITE_LOTE) {
      await despachar(lote.slice(0, LIMITE_LOTE));
      return void despachar(lote.slice(LIMITE_LOTE));
    }

    try {
      const rs = (await pedir({
        tipo: "batch",
        comandos: lote.map((p) => p.comando),
        // `read` é a segunda defesa: se o filtro de leitura deixar passar uma
        // escrita, o libsql recusa em vez de executá-la dentro do lote.
        modo: "read",
      })) as ResultadoSerializado[];
      lote.forEach((p, i) => p.resolver(reidratar(rs[i])));
    } catch {
      // Um lote é transacional: uma consulta ruim derruba as boas junto. Antes
      // da junção cada uma falhava sozinha, e essa isolação não pode ser o
      // preço da economia — no caminho de erro, refaz uma a uma.
      await Promise.all(lote.map(executarSozinho));
    }
  }

  async function executarSozinho(p: Pendente): Promise<void> {
    try {
      p.resolver(
        reidratar((await pedir({ tipo: "execute", comando: p.comando })) as ResultadoSerializado),
      );
    } catch (e) {
      p.rejeitar(e);
    }
  }

  const cliente = {
    closed: false,
    protocol: "http" as const,

    execute(stmt: InStatement): Promise<ResultSet> {
      const comando = normalizar(stmt);
      if (!ehLeitura(comando.sql)) {
        // Escrita vai sozinha e na hora: juntá-la a outras mudaria a
        // semântica de transação que ela hoje não tem.
        return pedir({ tipo: "execute", comando }).then((r) =>
          reidratar(r as ResultadoSerializado),
        );
      }
      return new Promise<ResultSet>((resolver, rejeitar) => {
        fila.push({ comando, resolver, rejeitar });
        agendar();
      });
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
