import { readFileSync } from "node:fs";
import type { Connect, Plugin } from "vite";

/**
 * Serve `/api/*` durante `npm run dev`.
 *
 * Em produção estas rotas são funções serverless (`api/*.ts`). O servidor do
 * Vite não serve `api/`, então sem isto `npm run dev` daria uma tela de login
 * que não funciona — e, desde que o banco passou a viver atrás de `/api/db`,
 * um app que não carrega nada.
 *
 * A regra NÃO é duplicada aqui: o plugin importa os mesmos módulos que as
 * funções serverless usam. O que ele faz é o transporte HTTP e a leitura do
 * `.env.local`.
 */
export function apiDev(): Plugin {
  return {
    name: "macronaut:api-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/login", rota(login));
      server.middlewares.use("/api/db", rota(banco));
      server.middlewares.use("/api/codigo", rota(codigo));
      server.middlewares.use("/api/parear", rota(parear));
      server.middlewares.use("/api/ingest", rota(ingest));
    },
  };
}

type Responder = (status: number, json: unknown) => void;
type Rota = (corpo: unknown, req: Connect.IncomingMessage, responder: Responder) => Promise<void>;

/** POST + corpo JSON + tratamento de erro, que as duas rotas compartilham. */
function rota(fn: Rota): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== "POST") return next();

    let cru = "";
    req.on("data", (c) => (cru += c));
    req.on("end", () => {
      const responder: Responder = (status, json) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(json));
      };
      void (async () => {
        try {
          await fn(JSON.parse(cru || "{}"), req, responder);
        } catch (e) {
          // Em dev a causa vai inteira para a tela: é a máquina do próprio
          // desenvolvedor, e adivinhar por que falhou é pior.
          responder(500, { error: e instanceof Error ? e.message : String(e) });
        }
      })();
    });
  };
}

/**
 * O segredo de assinatura em desenvolvimento.
 *
 * Fixo e avisado quando `AUTH_SECRET` não existe: exigir a variável faria
 * `npm run dev` parar de funcionar em toda máquina que ainda não a tem, e o
 * bilhete assinado aqui só vale contra o banco local. Na Vercel não há
 * fallback — `lerConfig` recusa subir sem o segredo de verdade.
 */
const SEGREDO_DEV = "macronaut-dev-inseguro";
let avisou = false;

function config() {
  const env = lerEnvLocal();
  const dbUrl = process.env.DB_URL ?? env.DB_URL;
  const dbToken = process.env.DB_TOKEN ?? env.DB_TOKEN;
  const segredo = process.env.AUTH_SECRET ?? env.AUTH_SECRET ?? SEGREDO_DEV;
  if (segredo === SEGREDO_DEV && !avisou) {
    avisou = true;
    console.warn(
      "[macronaut] AUTH_SECRET não definida: usando um segredo de desenvolvimento. " +
        "Defina AUTH_SECRET no .env.local e na Vercel antes de publicar.",
    );
  }
  return { dbUrl, dbToken, segredo };
}

async function cliente(dbUrl: string, dbToken: string | undefined) {
  const { createClient } = await import("@libsql/client");
  return createClient({ url: dbUrl, authToken: dbToken });
}

const login: Rota = async (corpo, _req, responder) => {
  const { email, senha } = (corpo ?? {}) as { email?: unknown; senha?: unknown };
  if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
    return responder(400, { error: "e-mail e senha são obrigatórios" });
  }

  const { dbUrl, dbToken, segredo } = config();
  if (!dbUrl) {
    return responder(500, {
      error:
        "DB_URL não configurada. Copie .env.example para .env.local e preencha antes de entrar.",
    });
  }

  const [{ authenticate }, { findUserByEmail }, auth, tokens] = await Promise.all([
    import("./api/_lib/login-core.js"),
    import("./src/repositories/users.js"),
    import("./src/domain/auth.js"),
    import("./api/_lib/tokens.js"),
  ]);

  const db = await cliente(dbUrl, dbToken);
  const r = await authenticate(
    {
      findUser: (e) => findUserByEmail(db, e),
      verify: auth.verifyPassword,
      dummyHash: auth.DUMMY_HASH,
      emitirToken: (u) =>
        tokens.emitir(
          { u, exp: Math.floor(Date.now() / 1000) + tokens.DURACAO_SESSAO_S, esc: "sessao" },
          segredo,
        ),
    },
    { email, senha },
  );

  if (!r.ok) return responder(401, { error: "e-mail ou senha inválidos" });
  return responder(200, { user: r.user, token: r.token });
};

const banco: Rota = async (corpo, req, responder) => {
  const { dbUrl, dbToken, segredo } = config();
  if (!dbUrl) return responder(500, { error: "DB_URL não configurada" });

  const [servidor, dbCore] = await Promise.all([
    import("./api/_lib/servidor.js"),
    import("./api/_lib/db-core.js"),
  ]);

  const sessao = servidor.autorizar(req.headers.authorization, segredo, "sessao");
  if (!sessao) return responder(401, { error: "401 sessão inválida ou expirada" });

  let pedido;
  try {
    pedido = dbCore.lerPedido(corpo);
  } catch (e) {
    return responder(400, { error: e instanceof Error ? e.message : String(e) });
  }

  const db = await cliente(dbUrl, dbToken);
  try {
    return responder(200, await dbCore.executarPedido(db, pedido));
  } catch (e) {
    // A mensagem do banco volta inteira: é dela que a tela tira "falta a
    // tabela X, rode db:setup".
    return responder(400, { error: e instanceof Error ? e.message : String(e) });
  }
};

const codigo: Rota = async (_corpo, req, responder) => {
  const { dbUrl, dbToken, segredo } = config();
  if (!dbUrl) return responder(500, { error: "DB_URL não configurada" });

  const [servidor, tokens, disp] = await Promise.all([
    import("./api/_lib/servidor.js"),
    import("./api/_lib/tokens.js"),
    import("./src/repositories/dispositivos.js"),
  ]);

  const sessao = servidor.autorizar(req.headers.authorization, segredo, "sessao");
  if (!sessao) return responder(401, { error: "401 sessão inválida ou expirada" });

  const db = await cliente(dbUrl, dbToken);
  const cru = tokens.gerarCodigo();
  const { expira_em } = await disp.criarCodigo(db, sessao.u, tokens.hashDeCodigo(cru, segredo));
  return responder(200, { codigo: cru, expira_em });
};

const parear: Rota = async (corpo, _req, responder) => {
  const { dbUrl, dbToken, segredo } = config();
  if (!dbUrl) return responder(500, { error: "DB_URL não configurada" });

  const { codigo: cru, nome, plataforma } = (corpo ?? {}) as Record<string, unknown>;
  const [tokens, disp] = await Promise.all([
    import("./api/_lib/tokens.js"),
    import("./src/repositories/dispositivos.js"),
  ]);
  if (typeof cru !== "string" || tokens.normalizarCodigo(cru).length !== 8) {
    return responder(400, { error: "código inválido" });
  }
  const aparelho = {
    nome: typeof nome === "string" && nome.trim() ? nome.trim().slice(0, 120) : "Aparelho",
    plataforma: plataforma === "android" ? "android" : "desconhecida",
  };

  const db = await cliente(dbUrl, dbToken);
  const r = await disp.resgatarCodigo(db, tokens.hashDeCodigo(cru, segredo), aparelho);
  if (!r) return responder(401, { error: "código inválido ou expirado" });

  return responder(200, {
    token: tokens.emitir(
      { u: r.userId, exp: tokens.SEM_EXPIRACAO, esc: "dispositivo", d: r.deviceId },
      segredo,
    ),
    dispositivo: { id: r.deviceId, nome: aparelho.nome },
  });
};

const ingest: Rota = async (corpo, req, responder) => {
  const { dbUrl, dbToken, segredo } = config();
  if (!dbUrl) return responder(500, { error: "DB_URL não configurada" });

  const [servidor, ingestCore, disp] = await Promise.all([
    import("./api/_lib/servidor.js"),
    import("./api/_lib/ingest-core.js"),
    import("./src/repositories/dispositivos.js"),
  ]);

  const dispositivo = servidor.autorizar(req.headers.authorization, segredo, "dispositivo");
  if (!dispositivo || typeof dispositivo.d !== "number") {
    return responder(401, { error: "401 token de dispositivo inválido" });
  }

  let lote;
  try {
    lote = ingestCore.lerLote(corpo);
  } catch (e) {
    return responder(400, { error: e instanceof Error ? e.message : String(e) });
  }

  const db = await cliente(dbUrl, dbToken);
  if (!(await disp.dispositivoAtivo(db, dispositivo.u, dispositivo.d))) {
    return responder(401, { error: "401 dispositivo revogado" });
  }
  const r = await ingestCore.gravarLote(db, dispositivo.u, lote);
  await disp.marcarVisto(db, dispositivo.d);
  return responder(200, r);
};

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
