import { createClient } from "@libsql/client";
import { setAiFlags } from "../src/repositories/ai.ts";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function onOff(v: string | undefined, nome: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === "on") return true;
  if (v === "off") return false;
  throw new Error(`${nome} deve ser on|off (recebido: ${v})`);
}

const email = (arg("--email") ?? "").trim().toLowerCase();
if (!email) throw new Error("uso: npm run ai:flags -- --email voce@x.com [--aloy on|off] [--gemini on|off]");

const flags = {
  aloy_enabled: onOff(arg("--aloy"), "--aloy"),
  gemini_enabled: onOff(arg("--gemini"), "--gemini"),
};

const url = process.env.DB_URL;
if (!url) throw new Error("DB_URL não definida (rode com --env-file=.env.local)");
const db = createClient({ url, authToken: process.env.DB_TOKEN });

const ok = await setAiFlags(db, email, flags);
db.close();
if (!ok) throw new Error(`e-mail não encontrado: ${email}`);
console.log(`Flags de IA atualizadas para ${email}:`, flags);
