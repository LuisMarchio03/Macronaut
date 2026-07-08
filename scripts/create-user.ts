import { createClient } from "@libsql/client";
import { hashPassword } from "../src/domain/auth.ts";
import { findUserByEmail, insertUser } from "../src/repositories/users.ts";
import { seedDefaultMeals } from "../src/repositories/meals.ts";

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

const url = process.env.DB_URL;
if (!url) throw new Error("DB_URL não definida (rode npm run db:setup antes)");
const db = createClient({ url, authToken: process.env.DB_TOKEN });

if (await findUserByEmail(db, email)) throw new Error(`e-mail já cadastrado: ${email}`);

const password_hash = await hashPassword(senha);
const user = await insertUser(db, { email, password_hash });
await seedDefaultMeals(db, user.id);
db.close();

console.log(`Usuário ${email} criado (id ${user.id}) com refeições padrão.`);
