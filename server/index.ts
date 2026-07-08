import express from "express";
import { createClient } from "@libsql/client";
import { authenticate } from "../shared/login-core";
import { verifyPassword, DUMMY_HASH } from "./auth";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 3001;
const app = express();

app.use(express.json());

app.post("/api/login", async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
    return res.status(400).json({ error: "e-mail e senha são obrigatórios" });
  }

  const dbUrl = process.env.DB_URL;
  const dbToken = process.env.DB_TOKEN;
  if (!dbUrl || !dbToken) return res.status(500).json({ error: "servidor mal configurado" });

  const publicDbUrl = process.env.DB_URL_PUBLIC ?? dbUrl;

  try {
    const db = createClient({ url: dbUrl, authToken: dbToken });

    const result = await authenticate(
      {
        findUser: async (e) => {
          const rs = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [e] });
          if (!rs.rows.length) return null;
          const r = rs.rows[0];
          return { id: r.id as number, email: r.email as string, password_hash: r.password_hash as string };
        },
        verify: verifyPassword,
        dummyHash: DUMMY_HASH,
        session: { dbUrl: publicDbUrl, token: dbToken },
      },
      { email, senha },
    );

    db.close();

    if (!result.ok) return res.status(401).json({ error: "e-mail ou senha inválidos" });
    return res.status(200).json({ user: result.user, dbUrl: result.dbUrl, token: result.token });
  } catch (e) {
    console.error("/api/login erro:", e);
    return res.status(500).json({ error: "erro ao autenticar" });
  }
});

const __dirname = dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve(__dirname, "../dist")));
  app.get("*", (_req, res) => res.sendFile(resolve(__dirname, "../dist/index.html")));
}

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
