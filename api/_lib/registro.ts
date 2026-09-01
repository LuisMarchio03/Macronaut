import type { Registro } from "./rpc-core.js";
import * as rotina from "../../src/repositories/rotina.js";
import * as sessao from "../../src/repositories/sessao.js";
import * as workouts from "../../src/repositories/workouts.js";
import * as progresso from "../../src/repositories/progresso.js";
import * as plano from "../../src/repositories/plano.js";
import * as entries from "../../src/repositories/entries.js";
import * as meals from "../../src/repositories/meals.js";
import * as mealTemplates from "../../src/repositories/meal-templates.js";
import * as foods from "../../src/repositories/foods.js";
import * as foodMeasures from "../../src/repositories/food-measures.js";
import * as exercises from "../../src/repositories/exercises.js";
import * as muscleGroups from "../../src/repositories/muscle-groups.js";
import * as activities from "../../src/repositories/activities.js";
import * as calistenia from "../../src/repositories/calistenia.js";
import * as profile from "../../src/repositories/profile.js";
import * as weighins from "../../src/repositories/weighins.js";
import * as water from "../../src/repositories/water.js";
import * as ai from "../../src/repositories/ai.js";
import * as dispositivos from "../../src/repositories/dispositivos.js";

/**
 * As operações que o cliente pode pedir.
 *
 * Gerado a partir do que os hooks de fato chamam — nada a mais. Funções de
 * seed, de backfill e as que só o servidor usa (`users.insertUser`,
 * `dispositivos.resgatarCodigo`, `plano.migrarTrocasDeBloco`) ficam de fora de
 * propósito: expor o que ninguém pede é superfície de ataque de graça.
 *
 * O escopo é declarado por operação:
 *
 * - `usuario` recebe o `user_id` do TOKEN como segundo argumento;
 * - `global` não recebe, porque a linha não tem dono.
 *
 * As poucas `global` merecem leitura. `activities.listActivityTypes` e
 * `muscle-groups.listMuscleGroups` são catálogo do app. Já `foods` e
 * `food_measures` são `global` porque **as tabelas não têm coluna de dono** —
 * no schema deste app o catálogo de alimentos é compartilhado, inclusive os
 * que você cadastrou. Marcar de `usuario` ali seria mentir sobre uma posse que
 * o banco não guarda; dar posse a eles é mudança de produto, e está anotada no
 * plano de migração.
 */
export const REGISTRO: Registro = {
  /* ── rotina ── */
  "rotina.adicionarExercicio": { escopo: "usuario", fn: rotina.adicionarExercicio },
  "rotina.atualizarExercicio": { escopo: "usuario", fn: rotina.atualizarExercicio },
  "rotina.criarRotina": { escopo: "usuario", fn: rotina.criarRotina },
  "rotina.getRotinaAtiva": { escopo: "usuario", fn: rotina.getRotinaAtiva },
  "rotina.listDias": { escopo: "usuario", fn: rotina.listDias },
  "rotina.listExercicios": { escopo: "usuario", fn: rotina.listExercicios },
  "rotina.listExerciciosDaRotina": { escopo: "usuario", fn: rotina.listExerciciosDaRotina },
  "rotina.removerDia": { escopo: "usuario", fn: rotina.removerDia },
  "rotina.removerExercicio": { escopo: "usuario", fn: rotina.removerExercicio },
  "rotina.reordenarExercicios": { escopo: "usuario", fn: rotina.reordenarExercicios },
  "rotina.salvarDia": { escopo: "usuario", fn: rotina.salvarDia },

  /* ── sessao ── */
  "sessao.adicionarAoPlano": { escopo: "usuario", fn: sessao.adicionarAoPlano },
  "sessao.adicionarSerie": { escopo: "usuario", fn: sessao.adicionarSerie },
  "sessao.criarSessao": { escopo: "usuario", fn: sessao.criarSessao },
  "sessao.desfazerSerie": { escopo: "usuario", fn: sessao.desfazerSerie },
  "sessao.finalizarSessao": { escopo: "usuario", fn: sessao.finalizarSessao },
  "sessao.getPlano": { escopo: "usuario", fn: sessao.getPlano },
  "sessao.iniciarSessao": { escopo: "usuario", fn: sessao.iniciarSessao },
  "sessao.marcasAmrap": { escopo: "usuario", fn: sessao.marcasAmrap },
  "sessao.montarItemAvulso": { escopo: "usuario", fn: sessao.montarItemAvulso },
  "sessao.montarPlanoDoDia": { escopo: "usuario", fn: sessao.montarPlanoDoDia },
  "sessao.registrarCardio": { escopo: "usuario", fn: sessao.registrarCardio },
  "sessao.registrarSerie": { escopo: "usuario", fn: sessao.registrarSerie },
  "sessao.removerExercicioDaSessao": { escopo: "usuario", fn: sessao.removerExercicioDaSessao },
  "sessao.removerSerie": { escopo: "usuario", fn: sessao.removerSerie },
  "sessao.reordenarExerciciosDaSessao": { escopo: "usuario", fn: sessao.reordenarExerciciosDaSessao },
  "sessao.sessaoAtiva": { escopo: "usuario", fn: sessao.sessaoAtiva },
  "sessao.sessoesAbertas": { escopo: "usuario", fn: sessao.sessoesAbertas },
  "sessao.trocarExercicioDaSessao": { escopo: "usuario", fn: sessao.trocarExercicioDaSessao },

  /* ── workouts ── */
  "workouts.addSet": { escopo: "usuario", fn: workouts.addSet },
  "workouts.createSession": { escopo: "usuario", fn: workouts.createSession },
  "workouts.deleteSession": { escopo: "usuario", fn: workouts.deleteSession },
  "workouts.deleteSet": { escopo: "usuario", fn: workouts.deleteSet },
  "workouts.getSession": { escopo: "usuario", fn: workouts.getSession },
  "workouts.getSessionByDate": { escopo: "usuario", fn: workouts.getSessionByDate },
  "workouts.historicoExercicio": { escopo: "usuario", fn: workouts.historicoExercicio },
  "workouts.listSessions": { escopo: "usuario", fn: workouts.listSessions },
  "workouts.listSessionsByRange": { escopo: "usuario", fn: workouts.listSessionsByRange },
  "workouts.listSetsBySession": { escopo: "usuario", fn: workouts.listSetsBySession },
  "workouts.setsForAnalise": { escopo: "usuario", fn: workouts.setsForAnalise },
  "workouts.setsForExercise": { escopo: "usuario", fn: workouts.setsForExercise },
  "workouts.ultimaVezExercicio": { escopo: "usuario", fn: workouts.ultimaVezExercicio },
  "workouts.updateSession": { escopo: "usuario", fn: workouts.updateSession },
  "workouts.updateSet": { escopo: "usuario", fn: workouts.updateSet },

  /* ── progresso ── */
  "progresso.exerciciosComHistorico": { escopo: "usuario", fn: progresso.exerciciosComHistorico },
  "progresso.seriesPorGrupo": { escopo: "usuario", fn: progresso.seriesPorGrupo },
  "progresso.sessoesComResumo": { escopo: "usuario", fn: progresso.sessoesComResumo },

  /* ── plano ── */
  "plano.addAguaNoBloco": { escopo: "usuario", fn: plano.addAguaNoBloco },
  "plano.aguaPorBloco": { escopo: "usuario", fn: plano.aguaPorBloco },
  "plano.ativarPlano": { escopo: "usuario", fn: plano.ativarPlano },
  "plano.deletarPlano": { escopo: "usuario", fn: plano.deletarPlano },
  "plano.getPlanoAtivo": { escopo: "usuario", fn: plano.getPlanoAtivo },
  "plano.importarPlano": { escopo: "usuario", fn: plano.importarPlano },
  "plano.listBlocos": { escopo: "usuario", fn: plano.listBlocos },
  "plano.listChecksDoDia": { escopo: "usuario", fn: plano.listChecksDoDia },
  "plano.listItensPorBloco": { escopo: "usuario", fn: plano.listItensPorBloco },
  "plano.listMacros": { escopo: "usuario", fn: plano.listMacros },
  "plano.listPlanos": { escopo: "usuario", fn: plano.listPlanos },
  "plano.listSubstituicoes": { escopo: "usuario", fn: plano.listSubstituicoes },
  "plano.listTrocasDoDia": { escopo: "usuario", fn: plano.listTrocasDoDia },
  "plano.marcarBloco": { escopo: "usuario", fn: plano.marcarBloco },
  "plano.removerTroca": { escopo: "usuario", fn: plano.removerTroca },
  "plano.salvarTroca": { escopo: "usuario", fn: plano.salvarTroca },

  /* ── entries ── */
  "entries.createEntry": { escopo: "usuario", fn: entries.createEntry },
  "entries.deleteEntry": { escopo: "usuario", fn: entries.deleteEntry },
  "entries.listEntriesByDate": { escopo: "usuario", fn: entries.listEntriesByDate },
  "entries.listEntriesByRange": { escopo: "usuario", fn: entries.listEntriesByRange },
  "entries.updateEntry": { escopo: "usuario", fn: entries.updateEntry },

  /* ── meals ── */
  "meals.createMeal": { escopo: "usuario", fn: meals.createMeal },
  "meals.deleteMeal": { escopo: "usuario", fn: meals.deleteMeal },
  "meals.listMeals": { escopo: "usuario", fn: meals.listMeals },
  "meals.reordenarMeals": { escopo: "usuario", fn: meals.reordenarMeals },
  "meals.updateMeal": { escopo: "usuario", fn: meals.updateMeal },

  /* ── meal-templates ── */
  "meal-templates.aplicar": { escopo: "usuario", fn: mealTemplates.aplicar },
  "meal-templates.criarDeEntries": { escopo: "usuario", fn: mealTemplates.criarDeEntries },
  "meal-templates.deleteTemplate": { escopo: "usuario", fn: mealTemplates.deleteTemplate },
  "meal-templates.listTemplates": { escopo: "usuario", fn: mealTemplates.listTemplates },
  "meal-templates.listTemplatesWithKcal": { escopo: "usuario", fn: mealTemplates.listTemplatesWithKcal },

  /* ── foods ── */
  "foods.createFood": { escopo: "global", fn: foods.createFood },
  "foods.deleteFood": { escopo: "global", fn: foods.deleteFood },
  "foods.getFoodsByIds": { escopo: "global", fn: foods.getFoodsByIds },
  "foods.listCategorias": { escopo: "global", fn: foods.listCategorias },
  "foods.listCustomFoods": { escopo: "global", fn: foods.listCustomFoods },
  "foods.listFoods": { escopo: "global", fn: foods.listFoods },
  "foods.searchFoods": { escopo: "global", fn: foods.searchFoods },
  "foods.updateFood": { escopo: "global", fn: foods.updateFood },

  /* ── food-measures ── */
  "food-measures.createMeasure": { escopo: "global", fn: foodMeasures.createMeasure },
  "food-measures.deleteMeasure": { escopo: "global", fn: foodMeasures.deleteMeasure },
  "food-measures.listCandidatos": { escopo: "global", fn: foodMeasures.listCandidatos },
  "food-measures.listMeasures": { escopo: "global", fn: foodMeasures.listMeasures },
  "food-measures.listMeasuresByFoodIds": { escopo: "global", fn: foodMeasures.listMeasuresByFoodIds },
  "food-measures.resolverCandidatas": { escopo: "global", fn: foodMeasures.resolverCandidatas },
  "food-measures.updateMeasure": { escopo: "global", fn: foodMeasures.updateMeasure },

  /* ── exercises ── */
  "exercises.createExercise": { escopo: "usuario", fn: exercises.createExercise },
  "exercises.deleteExercise": { escopo: "usuario", fn: exercises.deleteExercise },
  "exercises.listExercises": { escopo: "usuario", fn: exercises.listExercises },
  "exercises.updateExercise": { escopo: "usuario", fn: exercises.updateExercise },

  /* ── muscle-groups ── */
  "muscle-groups.listMuscleGroups": { escopo: "global", fn: muscleGroups.listMuscleGroups },

  /* ── activities ── */
  "activities.createActivitySession": { escopo: "usuario", fn: activities.createActivitySession },
  "activities.deleteActivitySession": { escopo: "usuario", fn: activities.deleteActivitySession },
  "activities.listActivitySessions": { escopo: "usuario", fn: activities.listActivitySessions },
  "activities.listActivitySessionsByRange": { escopo: "usuario", fn: activities.listActivitySessionsByRange },
  "activities.listActivityTypes": { escopo: "global", fn: activities.listActivityTypes },

  /* ── calistenia ── */
  "calistenia.apagarMeta": { escopo: "usuario", fn: calistenia.apagarMeta },
  "calistenia.apagarSerie": { escopo: "usuario", fn: calistenia.apagarSerie },
  "calistenia.exerciciosDeCalistenia": { escopo: "usuario", fn: calistenia.exerciciosDeCalistenia },
  "calistenia.listarMetas": { escopo: "usuario", fn: calistenia.listarMetas },
  "calistenia.registrarSerie": { escopo: "usuario", fn: calistenia.registrarSerie },
  "calistenia.salvarMeta": { escopo: "usuario", fn: calistenia.salvarMeta },
  "calistenia.seriesDoDia": { escopo: "usuario", fn: calistenia.seriesDoDia },
  "calistenia.seriesPorRange": { escopo: "usuario", fn: calistenia.seriesPorRange },
  "calistenia.usadosRecentemente": { escopo: "usuario", fn: calistenia.usadosRecentemente },

  /* ── profile ── */
  "profile.getProfile": { escopo: "usuario", fn: profile.getProfile },
  "profile.upsertProfile": { escopo: "usuario", fn: profile.upsertProfile },

  /* ── weighins ── */
  "weighins.getWeighInsByRange": { escopo: "usuario", fn: weighins.getWeighInsByRange },
  "weighins.upsertWeighIn": { escopo: "usuario", fn: weighins.upsertWeighIn },

  /* ── water ── */
  "water.addWater": { escopo: "usuario", fn: water.addWater },
  "water.getWaterByRange": { escopo: "usuario", fn: water.getWaterByRange },
  "water.getWaterTotal": { escopo: "usuario", fn: water.getWaterTotal },
  "water.resetWater": { escopo: "usuario", fn: water.resetWater },

  /* ── ai ── */
  "ai.getAiConfig": { escopo: "usuario", fn: ai.getAiConfig },
  "ai.setGeminiKey": { escopo: "usuario", fn: ai.setGeminiKey },
  "ai.getLatestSessionId": { escopo: "usuario", fn: ai.getLatestSessionId },
  "ai.listMessages": { escopo: "usuario", fn: ai.listMessages },

  /* ── dispositivos ── */
  "dispositivos.apagarDispositivo": { escopo: "usuario", fn: dispositivos.apagarDispositivo },
  "dispositivos.listarDispositivos": { escopo: "usuario", fn: dispositivos.listarDispositivos },
};
