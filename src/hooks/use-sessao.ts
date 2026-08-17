import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import type { TipoSerie } from "../domain/types";
import {
  adicionarAoPlano,
  desfazerSerie,
  finalizarSessao,
  getPlano,
  iniciarSessao,
  marcasAmrap,
  montarPlanoDoDia,
  registrarSerie,
  sessaoEmAndamento,
  type ItemPlanejado,
} from "../repositories/sessao";

export function useSessaoEmAndamento(data: string) {
  const db = useDb();
  const userId = useUserId();
  return useQuery({
    queryKey: ["sessao", "andamento", data],
    queryFn: () => sessaoEmAndamento(db, userId, data),
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
        ["sets-exercise"], ["ultima-vez"], ["historico-exercicio"],
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

export function useAdicionarAoPlano() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((v: { sessionId: number; item: ItemPlanejado }) =>
    adicionarAoPlano(db, userId, v.sessionId, v.item),
  );
}

export function useFinalizarSessao() {
  const db = useDb();
  const userId = useUserId();
  return useEscritaNaSessao((sessionId: number) => finalizarSessao(db, userId, sessionId));
}
