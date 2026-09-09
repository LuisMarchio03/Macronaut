import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { authenticate } from "./_lib/login-core.js";
import { lerConfig } from "./_lib/servidor.js";
import { DURACAO_SESSAO_S, emitir } from "./_lib/tokens.js";
import { findUserByEmail } from "../src/repositories/users.js";
import { verifyPassword, DUMMY_HASH } from "../src/domain/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  const { email, senha } = (req.body ?? {}) as { email?: unknown; senha?: unknown };
  if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
    return res.status(400).json({ error: "e-mail e senha são obrigatórios" });
  }

  let config;
  try {
    config = lerConfig(process.env);
  } catch (e) {
    console.error("api/login configuração:", e);
    return res.status(500).json({ error: "servidor mal configurado" });
  }

  try {
    const db = createClient({ url: config.dbUrl, authToken: config.dbToken });
    const result = await authenticate(
      {
        findUser: (e) => findUserByEmail(db, e),
        verify: verifyPassword,
        dummyHash: DUMMY_HASH,
        // O login devolve identidade, não credencial de banco. `DB_URL_PUBLIC`
        // saiu junto: não existe mais URL de banco para o cliente conhecer.
        emitirToken: (u) =>
          emitir(
            { u, exp: Math.floor(Date.now() / 1000) + DURACAO_SESSAO_S, esc: "sessao" },
            config.segredo,
          ),
      },
      { email, senha },
    );

    if (!result.ok) return res.status(401).json({ error: "e-mail ou senha inválidos" });
    return res.status(200).json({ user: result.user, token: result.token });
  } catch (e) {
    console.error("api/login erro:", e);
    return res.status(500).json({ error: "erro ao autenticar" });
  }
}
