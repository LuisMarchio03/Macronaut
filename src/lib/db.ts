import type { Client } from "@libsql/client/web";
import { criarBancoRemoto } from "./db-remoto";

export type { Client };

/**
 * O banco da sessão.
 *
 * Já foi um cliente libsql apontando direto para o Turso com o token da
 * sessão — o que punha a credencial do banco no navegador. Agora aponta para
 * `/api/db`, e o token do banco não sai do servidor.
 */
export function createUserDb(token: string): Client {
  return criarBancoRemoto(token);
}
