import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { applySchema } from "./lib/apply-schema.ts";
import { createDatabase, mintDbToken } from "../api/_lib/turso.ts";
import { hashPassword } from "../src/domain/auth.ts";
import { findUserByEmail, insertUser } from "../src/repositories/users.ts";
import { importarTaco, type TacoItem } from "./seed-taco.ts";
import { seedDefaultMeals } from "../src/repositories/meals.ts";
import { seedActivityTypes } from "../src/repositories/activities.ts";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const email = (arg("--email") ?? "").trim().toLowerCase();
const senha = arg("--senha") ?? "";
if (!email || !senha) {
  throw new Error("uso: npm run create-user -- --email voce@exemplo.com --senha ****");
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  throw new Error(`e-mail inválido: ${email}`);
}

const authUrl = process.env.AUTH_DB_URL;
if (!authUrl) throw new Error("AUTH_DB_URL não definida (rode npm run migrate:auth antes)");
const authDb = createClient({ url: authUrl, authToken: process.env.AUTH_DB_TOKEN });

if (await findUserByEmail(authDb, email)) throw new Error(`e-mail já cadastrado: ${email}`);

const slug = email.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
const dbName = `macronaut-${slug}-${randomBytes(3).toString("hex")}`;

// 1) cria o banco do usuário (a partir daqui já existe infra real no Turso)
const { dbUrl } = await createDatabase(dbName);

// Sem rollback automático de infra: se qualquer passo abaixo falhar, o banco já
// criado vira órfão — informamos db_name/db_url para limpeza manual.
try {
  const provToken = await mintDbToken(dbName, 1);

  // 2) aplica o schema do app e seed nesse banco
  const appSchemaPath = fileURLToPath(new URL("../src/db/schema.sql", import.meta.url));
  await applySchema(dbUrl, provToken, appSchemaPath);

  const userDb = createClient({ url: dbUrl, authToken: provToken });
  await seedDefaultMeals(userDb);
  await seedActivityTypes(userDb);
  const tacoPath = process.env.TACO_JSON ?? "data/taco.sample.json";
  let itens: TacoItem[] = [];
  try {
    itens = JSON.parse(readFileSync(fileURLToPath(new URL(`../${tacoPath}`, import.meta.url)), "utf-8"));
  } catch {
    console.warn(`Sem ${tacoPath}; pulando importação da TACO.`);
  }
  const n = await importarTaco(userDb, itens);
  userDb.close();

  // 3) grava o usuário no auth DB
  const password_hash = await hashPassword(senha);
  await insertUser(authDb, { email, password_hash, db_name: dbName, db_url: dbUrl });
  authDb.close();

  console.log(`Usuário ${email} criado. Banco ${dbName} (${n} alimentos da TACO importados).`);
} catch (err) {
  console.error(
    `Banco ${dbName} (${dbUrl}) foi criado, mas o provisionamento falhou — ` +
      `limpeza manual necessária (ex.: turso db destroy ${dbName}). Causa: ${err}`,
  );
  throw err;
}
