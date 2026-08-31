import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import type { TipoSerie } from "../domain/types";
import {
  adicionarAoPlano,
  adicionarSerie,
  desfazerSerie,
  finalizarSessao,
  getPlano,
  iniciarSessao,
  marcasAmrap,
  montarItemAvulso,
  montarPlanoDoDia,
  registrarCardio,
  registrarSerie,
  removerExercicioDaSessao,
  removerSerie,
  reordenarExerciciosDaSessao,
  sessaoEmAndamento,
  sessoesEmAndamento,
  trocarExercicioDaSessao,
  type ItemPlanejado,
} from "../repositories/sessao";
import { getSession, updateSession } from "../repositories/workouts";

/** A sessão pela id da URL — o cabeçalho da tela da academia sai daqui. */
export function useSessao(sessionId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "por-id", sessionId],
    queryFn: () => getSession(db, userId, sessionId!),
    enabled: sessionId != null,
  });
}

export function useSessaoEmAndamento(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "andamento", data],
    queryFn: () => sessaoEmAndamento(db, userId, data),
  });
}

/**
 * Todas as sessões abertas do dia.
 *
 * O hub lista uma linha por sessão: com duas abertas — o treino da rotina e um
 * avulso da noite — oferecer só a mais recente escondia a outra sem dizer que
 * ela existia.
 */
export function useSessoesEmAndamento(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "abertas", data],
    queryFn: () => sessoesEmAndamento(db, userId, data),
  });
}

export function usePlano(sessionId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "plano", sessionId],
    queryFn: () => getPlano(db, userId, sessionId!),
    enabled: sessionId != null,
  });
}

/** O treino de um dia da rotina, já com as cargas de hoje. */
export function usePlanoDoDia(dayId: number | undefined, data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "plano-do-dia", dayId, data],
    queryFn: () => montarPlanoDoDia(db, userId, dayId!, data),
    enabled: dayId != null,
  });
}

export function useMarcasAmrap(exerciseId: number | undefined) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "amrap", exerciseId],
    queryFn: () => marcasAmrap(db, userId, exerciseId!),
    enabled: exerciseId != null,
  });
}

/**
 * Uma escrita na sessão mexe no plano, no histórico e na progressão de uma vez.
 *
 * `sessions`, `session-sets`, `sets-exercise` e `ultima-vez` são chaves que
 * `use-workouts` já usa — invalidá-las aqui é o que mantém histórico e gráficos
 * verdadeiros sem a tela precisar saber que elas existem.
 */
function useEscritaNaSessao<TVars, TDados>(fn: (v: TVars) => Promise<TDados>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const chave of [
        ["sessao"], ["sessions"], ["session"], ["session-sets"],
        ["sets-exercise"], ["ultima-vez"], ["historico-exercicio"], ["progresso"],
      ]) {
        qc.invalidateQueries({ queryKey: chave });
      }
    },
  });
}

export function useIniciarSessao() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao(
    (v: { data: string; nome: string | null; itens: ItemPlanejado[] }) =>
      iniciarSessao(db, userId, v),
  );
}

export function useRegistrarSerie() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao(
    (v: {
      planId: number;
      reps: number;
      peso_kg: number;
      tipo: TipoSerie;
      rir: number | null;
      nota: string | null;
    }) =>
      registrarSerie(db, userId, v.planId, {
        reps: v.reps, peso_kg: v.peso_kg, tipo: v.tipo, rir: v.rir, nota: v.nota,
      }),
  );
}

export function useDesfazerSerie() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((planId: number) => desfazerSerie(db, userId, planId));
}

/**
 * Adiciona um exercício ao plano da sessão em andamento.
 *
 * Recebe a id do exercício, não o item montado: montar o item exige cruzar o
 * histórico dele (`montarItemAvulso`), e uma tela que faz isso sozinha ou
 * refaz a consulta ou — como fazia — chuta zero quilo.
 */
export function useAdicionarAoPlano() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao(
    async (v: { sessionId: number; exerciseId: number; data: string }) => {
      const item = await montarItemAvulso(db, userId, v.exerciseId, v.data);
      await adicionarAoPlano(db, userId, v.sessionId, item);
    },
  );
}

export function useFinalizarSessao() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((sessionId: number) => finalizarSessao(db, userId, sessionId));
}

export function useRegistrarCardio() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((v: { planId: number; duracao_min: number; kcal: number }) =>
    registrarCardio(db, userId, v.planId, { duracao_min: v.duracao_min, kcal: v.kcal }),
  );
}

/* ══════════════════════════════════════════════════════════════════
   EDITAR A SESSÃO

   Todas passam por `useEscritaNaSessao`: remover, trocar e reordenar mexem no
   plano E no realizado, então o histórico, a progressão e os gráficos têm que
   ser invalidados junto — não só a tela que disparou a ação.
   ══════════════════════════════════════════════════════════════════ */

export function useRemoverExercicioDaSessao() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((v: { sessionId: number; exerciseId: number }) =>
    removerExercicioDaSessao(db, userId, v.sessionId, v.exerciseId),
  );
}

export function useTrocarExercicioDaSessao() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((v: { sessionId: number; de: number; para: number }) =>
    trocarExercicioDaSessao(db, userId, v.sessionId, v.de, v.para),
  );
}

export function useReordenarExerciciosDaSessao() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((v: { sessionId: number; exerciseIds: number[] }) =>
    reordenarExerciciosDaSessao(db, userId, v.sessionId, v.exerciseIds),
  );
}

export function useAdicionarSerie() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((v: { sessionId: number; exerciseId: number }) =>
    adicionarSerie(db, userId, v.sessionId, v.exerciseId),
  );
}

export function useRemoverSerie() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((planId: number) => removerSerie(db, userId, planId));
}

/**
 * Nome, nota e data da sessão.
 *
 * Separada de `useUpdateSession` (de `use-workouts`): aquela é presa a uma
 * data — invalida `["session", data]` — e mudar justamente a data faria a
 * tela continuar mostrando a chave antiga. Esta invalida tudo que a sessão
 * toca, que é o que uma mudança de data exige.
 */
export function useEditarSessao() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao(
    (v: { id: number; nome?: string | null; nota?: string | null; data?: string }) =>
      updateSession(db, userId, v.id, { nome: v.nome, nota: v.nota, data: v.data }),
  );
}
