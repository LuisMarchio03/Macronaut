import type { Client, InValue, ResultSet } from "@libsql/client";

/**
 * O proxy do banco: o transporte entre o app e o Turso.
 *
 * O que ele resolve é a credencial. Antes, `/api/login` devolvia o token do
 * Turso ao navegador e o app falava direto com o banco — quem tivesse a
 * sessão tinha a credencial em mãos, utilizável fora do app, sem prazo e sem
 * revogação. Agora o token do banco não sai do servidor; o cliente carrega um
 * bilhete assinado, que expira e que dá para revogar.
 *
 * O que ele NÃO resolve, e é honesto dizer: o SQL continua vindo do cliente.
 * Uma sessão válida pode rodar qualquer consulta no banco daquele usuário —
 * que é o mesmo poder que a tela já tem. A defesa contra isso seria mover os
 * repositórios para cá, um endpoint por operação, e é uma reescrita de outra
 * ordem de grandeza. O ganho aqui é a credencial deixar de vazar; o ganho que
 * falta está anotado no README.
 *
 * É por isso que o celular NÃO usa esta rota: um APK distribuído com um token
 * capaz de rodar SQL arbitrário seria pior do que o problema original. Ele
 * fala com `/api/ingest`, que é tipado.
 */

export interface Comando {
  sql: string;
  args?: InValue[] | Record<string, InValue>;
}

export type PedidoDb =
  | { tipo: "execute"; comando: Comando }
  | { tipo: "batch"; comandos: Comando[]; modo?: "write" | "read" | "deferred" };

/** O `ResultSet` do libsql, reduzido ao que atravessa JSON. */
export interface ResultadoSerializado {
  columns: string[];
  rows: Record<string, unknown>[];
  rowsAffected: number;
  /** String porque no libsql é `bigint`, que `JSON.stringify` recusa. */
  lastInsertRowid: string | null;
}

/** Quantos comandos um `batch` pode carregar. O maior do app tem dezenas. */
export const LIMITE_BATCH = 200;

/**
 * `Row` do libsql é array E objeto ao mesmo tempo: tem os valores por índice e
 * por nome. Os repositórios só leem por nome, então é o que atravessa — e
 * `bigint` vira número, porque JSON não tem bigint e todo id deste app cabe
 * num `number` com folga.
 */
function serializarLinha(row: unknown, columns: string[]): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const c of columns) {
    const v = r[c];
    out[c] = typeof v === "bigint" ? Number(v) : v;
  }
  return out;
}

export function serializar(rs: ResultSet): ResultadoSerializado {
  const columns = rs.columns ?? [];
  return {
    columns,
    rows: rs.rows.map((r) => serializarLinha(r, columns)),
    rowsAffected: rs.rowsAffected,
    lastInsertRowid: rs.lastInsertRowid === undefined ? null : String(rs.lastInsertRowid),
  };
}

export class PedidoInvalido extends Error {}

/** O corpo cru do POST vira um pedido, ou explode dizendo o quê. */
export function lerPedido(corpo: unknown): PedidoDb {
  if (typeof corpo !== "object" || corpo === null) throw new PedidoInvalido("corpo ausente");
  const p = corpo as Record<string, unknown>;

  if (p.tipo === "execute") {
    return { tipo: "execute", comando: lerComando(p.comando) };
  }
  if (p.tipo === "batch") {
    if (!Array.isArray(p.comandos)) throw new PedidoInvalido("comandos deve ser uma lista");
    if (p.comandos.length === 0) throw new PedidoInvalido("batch vazio");
    if (p.comandos.length > LIMITE_BATCH) {
      throw new PedidoInvalido(`batch acima de ${LIMITE_BATCH} comandos`);
    }
    const modo = p.modo;
    if (modo !== undefined && modo !== "write" && modo !== "read" && modo !== "deferred") {
      throw new PedidoInvalido("modo inválido");
    }
    return { tipo: "batch", comandos: p.comandos.map(lerComando), modo };
  }
  throw new PedidoInvalido("tipo deve ser 'execute' ou 'batch'");
}

function lerComando(c: unknown): Comando {
  if (typeof c !== "object" || c === null) throw new PedidoInvalido("comando ausente");
  const o = c as Record<string, unknown>;
  if (typeof o.sql !== "string" || o.sql.trim() === "") {
    throw new PedidoInvalido("sql ausente");
  }
  if (o.args !== undefined && typeof o.args !== "object") {
    throw new PedidoInvalido("args deve ser lista ou objeto");
  }
  return { sql: o.sql, args: o.args as Comando["args"] };
}

export async function executarPedido(
  db: Client,
  pedido: PedidoDb,
): Promise<ResultadoSerializado | ResultadoSerializado[]> {
  if (pedido.tipo === "execute") {
    return serializar(await db.execute(pedido.comando as unknown as Parameters<Client["execute"]>[0]));
  }
  const rs = await db.batch(
    pedido.comandos as unknown as Parameters<Client["batch"]>[0],
    pedido.modo ?? "deferred",
  );
  return rs.map(serializar);
}
