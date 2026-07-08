import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { authenticate } from "./_lib/login-core";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scryptAsync(
  senha: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, keylen, options, (err, dk) => (err ? reject(err) : resolve(dk)));
  });
}

async function verifyPassword(senha: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, ns, rs, ps, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const dk = await scryptAsync(senha, salt, expected.length, {
    N: Number(ns), r: Number(rs), p: Number(ps),
  });
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}

const DUMMY_HASH =
  `scrypt$16384$8$1$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

import type { Row } from "@libsql/client";

async function findUserByEmail(email: string) {
  const url = process.env.DB_URL;
  const token = process.env.DB_TOKEN;
  if (!url || !token) throw new Error("DB_URL e DB_TOKEN são obrigatórios");
  const db = createClient({ url, authToken: token });
  try {
    const rs = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
    if (!rs.rows.length) return null;
    const r = rs.rows[0];
    return { id: r.id as number, email: r.email as string, password_hash: r.password_hash as string };
  } finally {
    db.close();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "método não permitido" });

  const { email, senha } = (req.body ?? {}) as { email?: unknown; senha?: unknown };
  if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
    return res.status(400).json({ error: "e-mail e senha são obrigatórios" });
  }

  const dbUrl = process.env.DB_URL;
  const dbToken = process.env.DB_TOKEN;
  if (!dbUrl || !dbToken) return res.status(500).json({ error: "servidor mal configurado" });
  const publicDbUrl = process.env.DB_URL_PUBLIC ?? dbUrl;

  try {
    const result = await authenticate(
      {
        findUser: (e) => findUserByEmail(e),
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
