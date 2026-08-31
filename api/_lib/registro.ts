import type { Registro } from "./rpc-core.js";
import * as rotina from "../../src/repositories/rotina.js";

/**
 * As operações que o cliente pode pedir.
 *
 * A migração é por módulo, e `/api/db` continua de pé para o que ainda não
 * chegou aqui — as duas rotas coexistem de propósito. **O ganho de segurança
 * só se realiza quando `/api/db` puder ser desligada**; até lá, isto é a
 * estrada sendo construída, não o buraco tapado.
 *
 * O escopo é declarado por operação, e o padrão mental é `usuario`. Marcar de
 * `global` o que tem dono é declarar a linha pública para qualquer sessão.
 */
export const REGISTRO: Registro = {
  /* ── rotina ────────────────────────────────────────────────────── */
  "rotina.getRotinaAtiva":        { escopo: "usuario", fn: rotina.getRotinaAtiva },
  "rotina.criarRotina":           { escopo: "usuario", fn: rotina.criarRotina },
  "rotina.listDias":              { escopo: "usuario", fn: rotina.listDias },
  "rotina.salvarDia":             { escopo: "usuario", fn: rotina.salvarDia },
  "rotina.removerDia":            { escopo: "usuario", fn: rotina.removerDia },
  "rotina.listExercicios":        { escopo: "usuario", fn: rotina.listExercicios },
  "rotina.listExerciciosDaRotina":{ escopo: "usuario", fn: rotina.listExerciciosDaRotina },
  "rotina.adicionarExercicio":    { escopo: "usuario", fn: rotina.adicionarExercicio },
  "rotina.atualizarExercicio":    { escopo: "usuario", fn: rotina.atualizarExercicio },
  "rotina.removerExercicio":      { escopo: "usuario", fn: rotina.removerExercicio },
  "rotina.reordenarExercicios":   { escopo: "usuario", fn: rotina.reordenarExercicios },
};
