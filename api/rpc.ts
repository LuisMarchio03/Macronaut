import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { autorizar, lerConfig } from "./_lib/servidor.js";
import { ChamadaInvalida, executarLote, lerChamadas } from "./_lib/rpc-core.js";
import { REGISTRO } from "./_lib/registro.js";

/**
 * O banco por operação nomeada, em vez de por SQL.
 *
 * Diferença que importa em relação a `/api/db`: o `user_id` vem do token, e o
 * cliente não escolhe a consulta — escolhe um nome que o servidor conhece.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  let config;
  try {
    config = lerConfig(process.env);
  } catch (e) {
    console.error("api/rpc configuração:", e);
    return res.status(500).json({ error: "servidor mal configurado" });
  }

  const sessao = autorizar(req.headers.authorization, config.segredo, "sessao");
  if (!sessao) return res.status(401).json({ error: "401 sessão inválida ou expirada" });

  let chamadas;
  try {
    chamadas = lerChamadas(req.body);
  } catch (e) {
    if (e instanceof ChamadaInvalida) return res.status(400).json({ error: e.message });
    throw e;
  }

  try {
    const db = createClient({ url: config.dbUrl, authToken: config.dbToken });
    return res.status(200).json(await executarLote(REGISTRO, db, sessao.u, chamadas));
  } catch (e) {
    console.error("api/rpc erro:", e);
    return res.status(500).json({ error: "erro ao executar" });
  }
}
