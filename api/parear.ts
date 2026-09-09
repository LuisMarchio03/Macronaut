import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { lerConfig } from "./_lib/servidor.js";
import { SEM_EXPIRACAO, emitir, hashDeCodigo, normalizarCodigo } from "./_lib/tokens.js";
import { resgatarCodigo } from "../src/repositories/dispositivos.js";

/**
 * O celular troca o código de oito caracteres por um token de dispositivo.
 *
 * É a única rota sem autenticação — o código É a autenticação. Ele dura cinco
 * minutos, vale uma vez e o que está no banco é o hash dele.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  const { codigo, nome, plataforma } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof codigo !== "string" || normalizarCodigo(codigo).length !== 8) {
    return res.status(400).json({ error: "código inválido" });
  }
  const aparelho = {
    nome: typeof nome === "string" && nome.trim() ? nome.trim().slice(0, 120) : "Aparelho",
    plataforma: plataforma === "android" ? "android" : "desconhecida",
  };

  let config;
  try {
    config = lerConfig(process.env);
  } catch (e) {
    console.error("api/parear configuração:", e);
    return res.status(500).json({ error: "servidor mal configurado" });
  }

  try {
    const db = createClient({ url: config.dbUrl, authToken: config.dbToken });
    const r = await resgatarCodigo(db, hashDeCodigo(codigo, config.segredo), aparelho);
    // Uma resposta só para código errado, vencido e já usado: distinguir os
    // três diria a quem está tentando o quanto ele chegou perto.
    if (!r) return res.status(401).json({ error: "código inválido ou expirado" });

    return res.status(200).json({
      token: emitir(
        { u: r.userId, exp: SEM_EXPIRACAO, esc: "dispositivo", d: r.deviceId },
        config.segredo,
      ),
      dispositivo: { id: r.deviceId, nome: aparelho.nome },
    });
  } catch (e) {
    console.error("api/parear erro:", e);
    return res.status(500).json({ error: "erro ao parear" });
  }
}
