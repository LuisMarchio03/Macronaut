import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { autorizar, lerConfig } from "./_lib/servidor.js";
import { LoteInvalido, gravarLote, lerLote } from "./_lib/ingest-core.js";
import { dispositivoAtivo, marcarVisto } from "../src/repositories/dispositivos.js";

/**
 * Por onde o celular manda o que leu do Health Connect.
 *
 * Tipada, e não SQL: o token daqui vai dentro de um APK distribuído e não
 * expira por tempo. O que o segura é a revogação — e é por isso que toda
 * chamada confere se o dispositivo ainda existe, em vez de confiar só na
 * assinatura do token.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  let config;
  try {
    config = lerConfig(process.env);
  } catch (e) {
    console.error("api/ingest configuração:", e);
    return res.status(500).json({ error: "servidor mal configurado" });
  }

  const dispositivo = autorizar(req.headers.authorization, config.segredo, "dispositivo");
  if (!dispositivo || typeof dispositivo.d !== "number") {
    return res.status(401).json({ error: "401 token de dispositivo inválido" });
  }

  let lote;
  try {
    lote = lerLote(req.body);
  } catch (e) {
    if (e instanceof LoteInvalido) return res.status(400).json({ error: e.message });
    throw e;
  }

  try {
    const db = createClient({ url: config.dbUrl, authToken: config.dbToken });

    // A assinatura prova quem emitiu, não que o aparelho ainda está
    // autorizado. Apagar o dispositivo na tela de ajustes tem que cortar a
    // sincronização na chamada seguinte, e é esta linha que faz isso.
    if (!(await dispositivoAtivo(db, dispositivo.u, dispositivo.d))) {
      return res.status(401).json({ error: "401 dispositivo revogado" });
    }

    const r = await gravarLote(db, dispositivo.u, lote);
    await marcarVisto(db, dispositivo.d);
    return res.status(200).json(r);
  } catch (e) {
    console.error("api/ingest erro:", e);
    return res.status(500).json({ error: "erro ao gravar" });
  }
}
