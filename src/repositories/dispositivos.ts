import type { Client, Row } from "@libsql/client";

/**
 * Os aparelhos que têm permissão de mandar dados para a sua conta.
 *
 * O par código-de-pareamento + token-de-dispositivo existe para o celular não
 * precisar guardar a sua senha nem um bilhete de sessão. A sessão expira em 30
 * dias e o worker de sincronização roda de madrugada — pedir a senha de novo
 * ali não é possível, e um token que morre sozinho viraria "o app parou de
 * sincronizar" sem nenhuma pista.
 *
 * O que dá segurança não é o prazo, é a revogação: apagar o dispositivo aqui
 * mata o token dele na hora, porque `/api/ingest` confere se ele ainda existe.
 */

export interface Dispositivo {
  id: number;
  nome: string;
  plataforma: string;
  created_at: string;
  /** Última vez que mandou dados. `null` = pareado e ainda calado. */
  visto_em: string | null;
}

function mapDispositivo(r: Row): Dispositivo {
  return {
    id: r.id as number,
    nome: r.nome as string,
    plataforma: r.plataforma as string,
    created_at: r.created_at as string,
    visto_em: (r.visto_em as string | null) ?? null,
  };
}

/** Quanto tempo o código fica de pé. Curto porque ele é curto. */
export const VALIDADE_CODIGO_MIN = 5;

export async function criarCodigo(
  db: Client,
  userId: number,
  codigoHash: string,
  agora = new Date(),
): Promise<{ expira_em: string }> {
  const expira_em = new Date(agora.getTime() + VALIDADE_CODIGO_MIN * 60_000).toISOString();
  // Um código pendente por vez: gerar outro invalida o anterior, senão a tela
  // mostraria um e três antigos continuariam valendo.
  await db.execute({
    sql: "DELETE FROM pairing_codes WHERE user_id = ? AND usado_em IS NULL",
    args: [userId],
  });
  await db.execute({
    sql: `INSERT INTO pairing_codes (user_id, codigo_hash, expira_em, usado_em, created_at)
          VALUES (?, ?, ?, NULL, ?)`,
    args: [userId, codigoHash, expira_em, agora.toISOString()],
  });
  return { expira_em };
}

/**
 * Troca o código por um dispositivo, uma vez só.
 *
 * A marcação de uso e a criação do dispositivo vão no mesmo `batch`: entre
 * "achei o código" e "usei o código" não pode caber uma segunda tentativa.
 */
export async function resgatarCodigo(
  db: Client,
  codigoHash: string,
  aparelho: { nome: string; plataforma: string },
  agora = new Date(),
): Promise<{ userId: number; deviceId: number } | null> {
  const agoraIso = agora.toISOString();
  const rs = await db.execute({
    sql: `SELECT id, user_id FROM pairing_codes
          WHERE codigo_hash = ? AND usado_em IS NULL AND expira_em > ?`,
    args: [codigoHash, agoraIso],
  });
  if (!rs.rows.length) return null;

  const codigoId = rs.rows[0].id as number;
  const userId = rs.rows[0].user_id as number;

  // O UPDATE repete a condição: se dois pedidos chegarem juntos, só um
  // encontra a linha ainda não usada.
  const usou = await db.execute({
    sql: "UPDATE pairing_codes SET usado_em = ? WHERE id = ? AND usado_em IS NULL",
    args: [agoraIso, codigoId],
  });
  if (usou.rowsAffected === 0) return null;

  const novo = await db.execute({
    sql: `INSERT INTO devices (user_id, nome, plataforma, created_at, visto_em)
          VALUES (?, ?, ?, ?, NULL)`,
    args: [userId, aparelho.nome, aparelho.plataforma, agoraIso],
  });
  return { userId, deviceId: Number(novo.lastInsertRowid) };
}

export async function listarDispositivos(db: Client, userId: number): Promise<Dispositivo[]> {
  const rs = await db.execute({
    sql: "SELECT * FROM devices WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return rs.rows.map(mapDispositivo);
}

/** Apagar é revogar: o token daquele aparelho para de valer no próximo envio. */
export async function apagarDispositivo(db: Client, userId: number, id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM devices WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

/**
 * O dispositivo do token ainda existe e é deste usuário?
 *
 * É o que transforma "apagar na tela" em revogação de verdade. Sem esta
 * conferência, o token assinado continuaria válido para sempre — ele não
 * expira por tempo de propósito.
 */
export async function dispositivoAtivo(
  db: Client,
  userId: number,
  deviceId: number,
): Promise<boolean> {
  const rs = await db.execute({
    sql: "SELECT 1 AS ok FROM devices WHERE id = ? AND user_id = ?",
    args: [deviceId, userId],
  });
  return rs.rows.length > 0;
}

export async function marcarVisto(db: Client, deviceId: number, agora = new Date()): Promise<void> {
  await db.execute({
    sql: "UPDATE devices SET visto_em = ? WHERE id = ?",
    args: [agora.toISOString(), deviceId],
  });
}
