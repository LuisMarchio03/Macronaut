import { scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

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

export const DUMMY_HASH =
  `scrypt$16384$8$1$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;
