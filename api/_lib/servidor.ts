import { verificar, type Escopo, type Payload } from "./tokens.js";

/**
 * O que o servidor precisa saber, e que o cliente não pode saber.
 *
 * `AUTH_SECRET` é novo e obrigatório: é a chave que assina os bilhetes de
 * sessão e de dispositivo. Sem ele o servidor não sobe — um segredo com valor
 * padrão é um segredo que ninguém troca, e aqui ele é o que separa "sou o
 * usuário 3" de "digo que sou o usuário 3".
 */
export interface Config {
  dbUrl: string;
  dbToken: string;
  segredo: string;
}

export class ConfigFaltando extends Error {}

export function lerConfig(env: Record<string, string | undefined>): Config {
  const dbUrl = env.DB_URL;
  const dbToken = env.DB_TOKEN;
  const segredo = env.AUTH_SECRET;

  const faltando = [
    !dbUrl && "DB_URL",
    !dbToken && "DB_TOKEN",
    !segredo && "AUTH_SECRET",
  ].filter(Boolean);

  if (faltando.length > 0) {
    throw new ConfigFaltando(`variáveis de ambiente ausentes: ${faltando.join(", ")}`);
  }
  return { dbUrl: dbUrl!, dbToken: dbToken!, segredo: segredo! };
}

/** `Authorization: Bearer <token>` → o payload, ou `null`. */
export function autorizar(
  cabecalho: string | string[] | undefined,
  segredo: string,
  escopo: Escopo,
): Payload | null {
  const cru = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  if (typeof cru !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(cru.trim());
  if (!m) return null;
  return verificar(m[1], segredo, escopo);
}
