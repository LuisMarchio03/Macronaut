import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Wrapper tipado no overload com opções (o promisify(scrypt) do node:util só
// expõe a assinatura de 3 args e não aceita o objeto de opções — TS2554).
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

const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

export async function hashPassword(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await scryptAsync(senha, salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

export async function verifyPassword(senha: string, stored: string): Promise<boolean> {
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

// Hash válido (parseável) mas impossível de casar, usado para igualar o custo de
// verificação quando o e-mail não existe (evita vazar timing / enumeração).
export const DUMMY_HASH =
  `scrypt$${N}$${r}$${p}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEYLEN).toString("base64")}`;
