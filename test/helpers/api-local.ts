import type { Client } from "@libsql/client";
import { criarApi, type Api } from "../../src/lib/api";
import { executarLote } from "../../api/_lib/rpc-core";
import { REGISTRO } from "../../api/_lib/registro";

/**
 * A `Api` dos testes: o MESMO registro e o MESMO despacho do servidor, sem
 * HTTP no meio.
 *
 * Testar componente contra um `fetch` de mentira testaria o mock. Aqui a
 * chamada percorre `executarLote` de verdade contra o banco de teste, então um
 * nome fora do registro ou um escopo errado falham no teste, não no navegador.
 */
export function criarApiLocal(db: Client, userId: number): Api {
  return criarApi((chamadas) => executarLote(REGISTRO, db, userId, chamadas));
}
