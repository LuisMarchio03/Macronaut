import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { authenticate } from "./_lib/login-core";
import { mintDbToken } from "./_lib/turso";
import { findUserByEmail } from "../src/repositories/users";
import { verifyPassword, DUMMY_HASH } from "../src/domain/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  const { email, senha } = (req.body ?? {}) as { email?: unknown; senha?: unknown };
  if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
    return res.status(400).json({ error: "e-mail e senha são obrigatórios" });
  }

  const authUrl = process.env.AUTH_DB_URL;
  if (!authUrl) return res.status(500).json({ error: "servidor mal configurado" });

  const ttl = Number(process.env.TOKEN_TTL_DAYS ?? 7);
  const days = Number.isFinite(ttl) && ttl > 0 ? ttl : 7;

  try {
    const authDb = createClient({ url: authUrl, authToken: process.env.AUTH_DB_TOKEN });
    const result = await authenticate(
      {
        findUser: (e) => findUserByEmail(authDb, e),
        verify: verifyPassword,
        dummyHash: DUMMY_HASH,
        mintToken: async (dbName) => ({
          token: await mintDbToken(dbName, days),
          exp: Date.now() + days * 86_400_000,
        }),
      },
      { email, senha },
    );

    if (!result.ok) return res.status(401).json({ error: "e-mail ou senha inválidos" });
    return res.status(200).json({
      user: result.user,
      dbUrl: result.dbUrl,
      token: result.token,
      exp: result.exp,
    });
  } catch (e) {
    // Falha inesperada (rede/Turso/config) — resposta genérica, sem vazar detalhes.
    console.error("api/login erro:", e);
    return res.status(500).json({ error: "erro ao autenticar" });
  }
}
