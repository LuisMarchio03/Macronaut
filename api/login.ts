import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { authenticate } from "./_lib/login-core.js";
import { findUserByEmail } from "../src/repositories/users.js";
import { verifyPassword, DUMMY_HASH } from "../src/domain/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  const { email, senha } = (req.body ?? {}) as { email?: unknown; senha?: unknown };
  if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
    return res.status(400).json({ error: "e-mail e senha são obrigatórios" });
  }

  const dbUrl = process.env.DB_URL;
  const dbToken = process.env.DB_TOKEN;
  if (!dbUrl || !dbToken) return res.status(500).json({ error: "servidor mal configurado" });
  // URL entregue ao cliente (pode diferir da server-side, ex.: réplica). Default = DB_URL.
  const publicDbUrl = process.env.DB_URL_PUBLIC ?? dbUrl;

  try {
    const db = createClient({ url: dbUrl, authToken: dbToken });
    const result = await authenticate(
      {
        findUser: (e) => findUserByEmail(db, e),
        verify: verifyPassword,
        dummyHash: DUMMY_HASH,
        session: { dbUrl: publicDbUrl, token: dbToken },
      },
      { email, senha },
    );

    if (!result.ok) return res.status(401).json({ error: "e-mail ou senha inválidos" });
    return res.status(200).json({ user: result.user, dbUrl: result.dbUrl, token: result.token });
  } catch (e) {
    console.error("api/login erro:", e);
    return res.status(500).json({ error: "erro ao autenticar" });
  }
}
