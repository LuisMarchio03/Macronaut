import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

/**
 * Serve `/api/login` durante `npm run dev`.
 *
 * Em produção o login é uma função serverless (`api/login.ts`). O servidor do
 * Vite não serve `api/`, então rodar `npm run dev` dava uma tela de login que
 * não funcionava — a única saída era instalar e autenticar o CLI da Vercel só
 * para conseguir entrar no próprio app em desenvolvimento.
 *
 * A regra de autenticação NÃO é duplicada aqui: este plugin importa a mesma
 * `authenticate` que a função serverless usa. O que ele faz é só o transporte
 * HTTP e a leitura do `.env.local`.
 */
export function loginDev(): Plugin {
  return {
    name: "macronaut:login-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/login", (req, res, next) => {
        if (req.method !== "POST") return next();

        let corpo = "";
        req.on("data", (c) => (corpo += c));
        req.on("end", () => {
          void (async () => {
            const responder = (status: number, json: unknown) => {
              res.statusCode = status;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(json));
            };

            try {
              const { email, senha } = JSON.parse(corpo || "{}");
              if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
                return responder(400, { error: "e-mail e senha são obrigatórios" });
              }

              const env = lerEnvLocal();
              const dbUrl = process.env.DB_URL ?? env.DB_URL;
              const dbToken = process.env.DB_TOKEN ?? env.DB_TOKEN;
              if (!dbUrl) {
                return responder(500, {
                  error:
                    "DB_URL não configurada. Copie .env.example para .env.local e preencha antes de entrar.",
                });
              }

              const [{ createClient }, { authenticate }, { findUserByEmail }, auth] =
                await Promise.all([
                  import("@libsql/client"),
                  import("./api/_lib/login-core.js"),
                  import("./src/repositories/users.js"),
                  import("./src/domain/auth.js"),
                ]);

              const db = createClient({ url: dbUrl, authToken: dbToken });
              const r = await authenticate(
                {
                  findUser: (e) => findUserByEmail(db, e),
                  verify: auth.verifyPassword,
                  dummyHash: auth.DUMMY_HASH,
                  session: { dbUrl: env.DB_URL_PUBLIC ?? dbUrl, token: dbToken ?? "" },
                },
                { email, senha },
              );

              if (!r.ok) return responder(401, { error: "e-mail ou senha inválidos" });
              return responder(200, { user: r.user, dbUrl: r.dbUrl, token: r.token });
            } catch (e) {
              // Em dev a causa vai inteira para a tela: é a máquina do próprio
              // desenvolvedor, e adivinhar por que o login falhou é pior.
              return responder(500, {
                error: `erro ao autenticar em desenvolvimento: ${
                  e instanceof Error ? e.message : String(e)
                }`,
              });
            }
          })();
        });
      });
    },
  };
}

/** Lê `.env.local` sem depender de o processo ter sido iniciado com --env-file. */
function lerEnvLocal(): Record<string, string> {
  try {
    const texto = readFileSync(".env.local", "utf-8");
    const out: Record<string, string> = {};
    for (const linha of texto.split("\n")) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(linha);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}
