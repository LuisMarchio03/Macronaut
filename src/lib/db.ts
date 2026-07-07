import { createClient, type Client } from "@libsql/client/web";

export type { Client };

// O client agora nasce após o login, com a URL e o token pessoais da sessão.
// Nada de segredo de banco no bundle (as VITE_TURSO_* foram removidas).
export function createUserDb(url: string, authToken: string): Client {
  return createClient({ url, authToken });
}
