import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { applySchema } from "./lib/apply-schema.ts";
import { importarTaco, type TacoItem } from "./seed-taco.ts";
import { seedActivityTypes } from "../src/repositories/activities.ts";
import { seedMuscleGroups } from "../src/repositories/muscle-groups.ts";
import { seedExercicios, backfillGrupos, backfillUserIds } from "../src/repositories/exercises.ts";
import { CATALOGO } from "../src/db/catalogo-exercicios.ts";

const url = process.env.DB_URL;
if (!url) throw new Error("DB_URL não definida");
const token = process.env.DB_TOKEN;

// 1) schema (inclui users + tabelas do app)
const schemaPath = fileURLToPath(new URL("../src/db/schema.sql", import.meta.url));
await applySchema(url, token, schemaPath);

// 2) seed dos catálogos globais (idempotentes)
const db = createClient({ url, authToken: token });
await seedActivityTypes(db);
await seedMuscleGroups(db);
await seedExercicios(db);
const nBackfill = await backfillGrupos(db);
const nBackfillUserIds = await backfillUserIds(db);

const tacoPath = process.env.TACO_JSON ?? "data/taco.sample.json";
let itens: TacoItem[] = [];
try {
  itens = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../${tacoPath}`, import.meta.url)), "utf-8"),
  );
} catch {
  console.warn(`Sem ${tacoPath}; pulando importação da TACO.`);
}
const n = await importarTaco(db, itens);
db.close();

console.log(
  `Banco pronto: schema aplicado, tipos de atividade e ${CATALOGO.length} exercícios seedados, ` +
    `${nBackfill} exercícios com grupo migrado, ${nBackfillUserIds} exercícios com dono migrado, ` +
    `${n} alimentos da TACO.`,
);
