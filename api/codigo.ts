import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { autorizar, lerConfig } from "./_lib/servidor.js";
import { gerarCodigo, hashDeCodigo } from "./_lib/tokens.js";
import { criarCodigo } from "../src/repositories/dispositivos.js";

/**
 * O app web pede um código para mostrar na tela.
 *
 * Só esta parte precisa do servidor: o banco guarda o HASH do código, e o
 * hash usa o segredo de assinatura — que o navegador não tem. Listar e apagar
 * dispositivos não passa por aqui; são consultas comuns, e o app já as faz
 * pelo caminho de sempre.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  let config;
  try {
    config = lerConfig(process.env);
  } catch (e) {
    console.error("api/codigo configuração:", e);
    return res.status(500).json({ error: "servidor mal configurado" });
  }

  const sessao = autorizar(req.headers.authorization, config.segredo, "sessao");
  if (!sessao) return res.status(401).json({ error: "401 sessão inválida ou expirada" });

  try {
    const db = createClient({ url: config.dbUrl, authToken: config.dbToken });
    const codigo = gerarCodigo();
    const { expira_em } = await criarCodigo(db, sessao.u, hashDeCodigo(codigo, config.segredo));
    // O código em claro existe só nesta resposta: no banco fica o hash.
    return res.status(200).json({ codigo, expira_em });
  } catch (e) {
    console.error("api/codigo erro:", e);
    return res.status(500).json({ error: "erro ao gerar o código" });
  }
}
