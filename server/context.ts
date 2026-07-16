import type { Client } from "@libsql/client";
import { getProfile } from "../src/repositories/profile.ts";
import { listEntriesByDate } from "../src/repositories/entries.ts";
import { getFoodsByIds } from "../src/repositories/foods.ts";
import { getWaterTotal } from "../src/repositories/water.ts";
import { getSessionByDate, listSetsBySession } from "../src/repositories/workouts.ts";
import { listExercises } from "../src/repositories/exercises.ts";
import { totaisDoDia } from "../src/domain/nutrition.ts";
import { seriesEfetivas } from "../src/domain/treino.ts";

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

export async function buildUserContext(db: Client, userId: number, data: string): Promise<string> {
  const perfil = await getProfile(db, userId);
  const entries = await listEntriesByDate(db, userId, data);
  const ids = [...new Set(entries.map((e) => e.food_id))];
  const foods = await getFoodsByIds(db, ids);
  const cons = totaisDoDia(entries, foods);
  const aguaMl = await getWaterTotal(db, userId, data);

  const linhas: string[] = [`Contexto do usuário em ${data} (Macronaut).`];

  if (perfil) {
    const restKcal = r0(perfil.meta_kcal - cons.kcal);
    linhas.push(
      `Nutrição: meta ${r0(perfil.meta_kcal)} kcal, consumido ${r0(cons.kcal)} (restam ${restKcal}). ` +
      `Proteína ${r0(cons.prot_g)}/${r0(perfil.meta_prot_g)} g, ` +
      `carbo ${r0(cons.carb_g)}/${r0(perfil.meta_carb_g)} g, ` +
      `gordura ${r0(cons.gord_g)}/${r0(perfil.meta_gord_g)} g. Objetivo: ${perfil.objetivo}.`,
    );
  } else {
    linhas.push("Nutrição: metas ainda não definidas.");
  }

  linhas.push(`Água: ${r1(aguaMl / 1000)} L hoje.`);

  const sessao = await getSessionByDate(db, userId, data);
  if (sessao) {
    const sets = seriesEfetivas(await listSetsBySession(db, userId, sessao.id));
    const nomes = new Map((await listExercises(db, userId)).map((e) => [e.id, e.nome]));
    const porEx = new Map<number, number>();
    for (const s of sets) porEx.set(s.exercise_id, (porEx.get(s.exercise_id) ?? 0) + 1);
    const resumo = [...porEx.entries()]
      .map(([exId, n]) => `${nomes.get(exId) ?? "exercício"} ${n}×`)
      .join(", ");
    linhas.push(`Treino de hoje: ${resumo || "sessão sem séries"}.`);
  } else {
    linhas.push("Treino: sem treino hoje.");
  }

  return linhas.join("\n");
}
