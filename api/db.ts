import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { autorizar, lerConfig } from "./_lib/servidor.js";
import { PedidoInvalido, executarPedido, lerPedido } from "./_lib/db-core.js";

/**
 * O banco, agora atrás do servidor.
 *
 * Só o escopo `sessao` entra: o token do celular é de dispositivo e vale
 * apenas em `/api/ingest`, que é tipado. Um APK distribuído com permissão de
 * rodar SQL arbitrário seria pior do que o problema que este proxy veio
 * resolver.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  let config;
  try {
    config = lerConfig(process.env);
  } catch (e) {
    console.error("api/db configuração:", e);
    return res.status(500).json({ error: "servidor mal configurado" });
  }

  const sessao = autorizar(req.headers.authorization, config.segredo, "sessao");
  // A palavra "401" na mensagem é o que faz o app deslogar sozinho em vez de
  // ficar tentando de novo com um bilhete morto (ver `isAuthError`).
  if (!sessao) return res.status(401).json({ error: "401 sessão inválida ou expirada" });

  let pedido;
  try {
    pedido = lerPedido(req.body);
  } catch (e) {
    if (e instanceof PedidoInvalido) return res.status(400).json({ error: e.message });
    throw e;
  }

  const db = createClient({ url: config.dbUrl, authToken: config.dbToken });
  try {
    return res.status(200).json(await executarPedido(db, pedido));
  } catch (e) {
    // A mensagem do banco volta inteira: é dela que a tela tira "falta a
    // tabela X, rode db:setup". Genérico aqui seria um usuário sem pista.
    const msg = e instanceof Error ? e.message : String(e);
    console.error("api/db erro:", msg);
    return res.status(400).json({ error: msg });
  }
}
