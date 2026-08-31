import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { applySchema } from "./lib/apply-schema.ts";
import { importarTaco, backfillNutrientes, type TacoItem } from "./seed-taco.ts";
import { semearMedidas } from "./seed-medidas.ts";
import type { MedidasDeAlimento } from "./build-medidas.ts";
import { backfillNomeNorm } from "../src/repositories/foods.ts";
import { seedActivityTypes } from "../src/repositories/activities.ts";
import { seedMuscleGroups } from "../src/repositories/muscle-groups.ts";
import {
  seedExercicios, backfillGrupos, backfillUserIds, backfillCalistenia,
} from "../src/repositories/exercises.ts";
import { CATALOGO } from "../src/db/catalogo-exercicios.ts";
import { seedExerciciosDeCardio } from "../src/db/seed-cardio.ts";
import { migrarTrocasDeBloco } from "../src/repositories/plano.ts";

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
const nCardio = await seedExerciciosDeCardio(db);
const nBackfill = await backfillGrupos(db);
const nBackfillUserIds = await backfillUserIds(db);
const nCalistenia = await backfillCalistenia(db);

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
const nNutrientes = await backfillNutrientes(db, itens);

let medidas: MedidasDeAlimento[] = [];
try {
  medidas = JSON.parse(
    readFileSync(fileURLToPath(new URL("../src/data/medidas.json", import.meta.url)), "utf-8"),
  );
} catch {
  console.warn("Sem src/data/medidas.json; pulando medidas caseiras (rode scripts/build-medidas.ts).");
}
const nMedidas = await semearMedidas(db, medidas);

// Depois da TACO: normaliza o nome de tudo que entrou, para a busca funcionar
// sem acento. Idempotente — só toca em linha com `nome_norm` NULL.
const nNomesNorm = await backfillNomeNorm(db);

// A troca de UMA linha da refeição virou tabela própria. A coluna antiga
// (`plan_checks.swap_id`) fica no banco; o que ela guardava passa a viver onde
// a tela lê.
const nTrocas = await migrarTrocasDeBloco(db);
db.close();

console.log(
  `Banco pronto: schema aplicado, tipos de atividade e ${CATALOGO.length} exercícios seedados, ` +
    `${nCardio} exercícios de cardio criados, ` +
    `${nBackfill} exercícios com grupo migrado, ${nBackfillUserIds} exercícios com dono migrado, ` +
    `${nCalistenia} exercícios de peso corporal com MET e fração migrados, ` +
    `${n} alimentos da TACO, ${nNutrientes} alimentos com nutrientes migrados` +
    `, ${nMedidas} medidas caseiras da POF, ${nNomesNorm} nomes normalizados para busca` +
    `, ${nTrocas} trocas de bloco migradas para trocas de item.`,
);
