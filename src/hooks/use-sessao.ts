import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";
import type { TipoSerie } from "../domain/types";
import type { ItemPlanejado } from "../repositories/sessao";

/** A sessão pela id da URL — o cabeçalho da tela da academia sai daqui. */
export function useSessao(sessionId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["sessao", "por-id", sessionId],
    queryFn: () => api["workouts"].getSession(sessionId!),
    enabled: sessionId != null,
  });
}

/**
 * Todos os treinos não concluídos, de qualquer dia.
 *
 * Sem chave de data, de propósito: a lista muda quando uma sessão abre ou
 * fecha, não quando o relógio vira — e uma chave por dia deixava o treino de
 * ontem num cache que ninguém mais consultava, que é a versão em memória do
 * mesmo bug que `sessoesAbertas` corrigiu no SQL.
 */
export function useSessoesAbertas() {
  const api = useApi();
  return useQuery({
    queryKey: ["sessao", "abertas"],
    queryFn: () => api["sessao"].sessoesAbertas(),
  });
}

/** O treino acontecendo agora — rascunho não conta. */
export function useSessaoAtiva() {
  const api = useApi();
  return useQuery({
    queryKey: ["sessao", "ativa"],
    queryFn: () => api["sessao"].sessaoAtiva(),
  });
}

export function usePlano(sessionId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["sessao", "plano", sessionId],
    queryFn: () => api["sessao"].getPlano(sessionId!),
    enabled: sessionId != null,
  });
}

/** O treino de um dia da rotina, já com as cargas de hoje. */
export function usePlanoDoDia(dayId: number | undefined, data: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["sessao", "plano-do-dia", dayId, data],
    queryFn: () => api["sessao"].montarPlanoDoDia(dayId!, data),
    enabled: dayId != null,
  });
}

export function useMarcasAmrap(exerciseId: number | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["sessao", "amrap", exerciseId],
    queryFn: () => api["sessao"].marcasAmrap(exerciseId!),
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

/** Cria o rascunho — a rotina com o plano do dia, o avulso vazio. */
export function useCriarSessao() {
  const api = useApi();
  return useEscritaNaSessao(
    (v: { data: string; nome: string | null; itens: ItemPlanejado[] }) =>
      api["sessao"].criarSessao(v),
  );
}

/** Rascunho → em andamento. É o "Iniciar treino" da tela da academia. */
export function useIniciarTreino() {
  const api = useApi();
  return useEscritaNaSessao((sessionId: number) => api["sessao"].iniciarSessao(sessionId));
}

/**
 * Descartar um rascunho, ou um treino aberto que não vai ser terminado.
 *
 * `workouts.deleteSession` já leva plano, séries e o cardio de
 * `activity_sessions` junto — não havia função nova a escrever, só uma tela
 * que ainda não a chamava.
 */
export function useDescartarSessao() {
  const api = useApi();
  return useEscritaNaSessao((sessionId: number) => api["workouts"].deleteSession(sessionId));
}

export function useRegistrarSerie() {
  const api = useApi();
  return useEscritaNaSessao(
    (v: {
      planId: number;
      reps: number;
      peso_kg: number;
      tipo: TipoSerie;
      rir: number | null;
      nota: string | null;
    }) =>
      api["sessao"].registrarSerie(v.planId, {
        reps: v.reps, peso_kg: v.peso_kg, tipo: v.tipo, rir: v.rir, nota: v.nota,
      }),
  );
}

export function useDesfazerSerie() {
  const api = useApi();
  return useEscritaNaSessao((planId: number) => api["sessao"].desfazerSerie(planId));
}

/**
 * Adiciona um exercício ao plano da sessão em andamento.
 *
 * Recebe a id do exercício, não o item montado: montar o item exige cruzar o
 * histórico dele (`montarItemAvulso`), e uma tela que faz isso sozinha ou
 * refaz a consulta ou — como fazia — chuta zero quilo.
 */
export function useAdicionarAoPlano() {
  const api = useApi();
  return useEscritaNaSessao(
    async (v: { sessionId: number; exerciseId: number; data: string }) => {
      const item = await api["sessao"].montarItemAvulso(v.exerciseId, v.data);
      await api["sessao"].adicionarAoPlano(v.sessionId, item);
    },
  );
}

export function useFinalizarSessao() {
  const api = useApi();
  return useEscritaNaSessao((sessionId: number) => api["sessao"].finalizarSessao(sessionId));
}

export function useRegistrarCardio() {
  const api = useApi();
  return useEscritaNaSessao((v: { planId: number; duracao_min: number; kcal: number }) =>
    api["sessao"].registrarCardio(v.planId, { duracao_min: v.duracao_min, kcal: v.kcal }),
  );
}

/* ══════════════════════════════════════════════════════════════════
   EDITAR A SESSÃO

   Todas passam por `useEscritaNaSessao`: remover, trocar e reordenar mexem no
   plano E no realizado, então o histórico, a progressão e os gráficos têm que
   ser invalidados junto — não só a tela que disparou a ação.
   ══════════════════════════════════════════════════════════════════ */

export function useRemoverExercicioDaSessao() {
  const api = useApi();
  return useEscritaNaSessao((v: { sessionId: number; exerciseId: number }) =>
    api["sessao"].removerExercicioDaSessao(v.sessionId, v.exerciseId),
  );
}

export function useTrocarExercicioDaSessao() {
  const api = useApi();
  return useEscritaNaSessao((v: { sessionId: number; de: number; para: number }) =>
    api["sessao"].trocarExercicioDaSessao(v.sessionId, v.de, v.para),
  );
}

export function useReordenarExerciciosDaSessao() {
  const api = useApi();
  return useEscritaNaSessao((v: { sessionId: number; exerciseIds: number[] }) =>
    api["sessao"].reordenarExerciciosDaSessao(v.sessionId, v.exerciseIds),
  );
}

export function useAdicionarSerie() {
  const api = useApi();
  return useEscritaNaSessao((v: { sessionId: number; exerciseId: number }) =>
    api["sessao"].adicionarSerie(v.sessionId, v.exerciseId),
  );
}

export function useRemoverSerie() {
  const api = useApi();
  return useEscritaNaSessao((planId: number) => api["sessao"].removerSerie(planId));
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
  const api = useApi();
  return useEscritaNaSessao(
    (v: { id: number; nome?: string | null; nota?: string | null; data?: string }) =>
      api["workouts"].updateSession(v.id, { nome: v.nome, nota: v.nota, data: v.data }),
  );
}
