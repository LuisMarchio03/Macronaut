import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronRight, Play, TrendingUp } from "lucide-react";
import { Card, CardRow } from "@/components/ui/card";
import { Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton";
import { useDiasDaRotina, useRotinaAtiva } from "@/hooks/use-rotina";
import { useIniciarSessao, usePlanoDoDia, useSessaoEmAndamento } from "@/hooks/use-sessao";
import { useListSessions } from "@/hooks/use-workouts";
import { proximoTreino, treinoDoDia } from "@/domain/prescricao";
import type { ItemPlanejado } from "@/repositories/sessao";
import { dataPorExtenso, dataRelativa, diaSemana, hoje } from "@/lib/date";
import { DIAS_DA_SEMANA } from "./treino-rotina";

/**
 * Dois destinos, não cinco.
 *
 * O hub era um menu de objetos — histórico, progressão, exercícios, cardio — e
 * duas dessas telas respondiam a mesma pergunta. Agora são perguntas: o que eu
 * treino na semana, e o que eu já fiz.
 */
const ATALHOS = [
  { to: "/treino/rotina", icone: CalendarDays, label: "Rotina", sub: "O que você treina em cada dia" },
  { to: "/treino/progresso", icone: TrendingUp, label: "Progresso", sub: "Sessões, cargas e consistência" },
];

/**
 * Como o card de hoje descreve um exercício.
 *
 * Só as séries de trabalho entram: o 5/3/1 começa por três séries de
 * aquecimento, e resumir pela primeira linha do array prometia "5 × 32,5 kg"
 * para um treino que sobe até 67,5. Carga zero não é uma carga — é a ausência
 * de uma, e o card convida a defini-la em vez de mostrar "0 kg".
 */
function resumoDoItem(item: ItemPlanejado): string {
  const trabalho = item.series.filter((s) => s.tipo !== "aquecimento");
  if (trabalho.length === 0) return "sem séries";

  const pesos = trabalho.map((s) => s.peso_kg);
  const maisPesada = Math.max(...pesos);
  if (maisPesada === 0) return `${trabalho.length} séries · definir carga`;

  const cargaUnica = pesos.every((p) => p === maisPesada);
  const repsUnicas = trabalho.every((s) => s.reps_alvo === trabalho[0].reps_alvo);
  return cargaUnica && repsUnicas
    ? `${trabalho.length} × ${trabalho[0].reps_alvo} × ${maisPesada} kg`
    : `${trabalho.length} séries · até ${maisPesada} kg`;
}

export function Treino() {
  const navigate = useNavigate();
  const data = hoje();
  const hojeSemana = diaSemana(data);

  const { data: rotina, isLoading } = useRotinaAtiva();
  const { data: dias = [] } = useDiasDaRotina(rotina);
  const dia = treinoDoDia(dias, hojeSemana);
  const proximo = proximoTreino(dias, hojeSemana);

  const { data: plano = [] } = usePlanoDoDia(dia?.id, data);
  const { data: emAndamento } = useSessaoEmAndamento(data);
  const { data: recentes = [] } = useListSessions();
  const iniciar = useIniciarSessao();

  function comecar(itens: ItemPlanejado[]) {
    iniciar.mutate(
      { data, nome: dia?.nome ?? "Treino livre", itens },
      { onSuccess: (id) => navigate(`/treino/sessao?s=${id}`) },
    );
  }

  if (isLoading) {
    return (
      <Page>
        <SkeletonCard />
        <SkeletonList rows={3} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader eyebrow={dataPorExtenso(data)} title="Treino" />

      {!rotina ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="Nenhuma rotina configurada"
            description="Diga ao app o que você treina em cada dia da semana. Depois é só abrir e seguir — a carga de cada exercício ele calcula sozinho, e sobe quando você bater a meta."
            action={<ButtonLink to="/treino/rotina">Montar rotina</ButtonLink>}
          />
        </Card>
      ) : emAndamento ? (
        <Card tone="primary">
          <p className="t-caption">Sessão em andamento</p>
          <h2 className="t-title mt-0.5">{emAndamento.nome ?? "Treino"}</h2>
          <p className="t-caption mt-1 tabular-nums">
            {emAndamento.feitas} de {emAndamento.total} séries
          </p>
          <ButtonLink to={`/treino/sessao?s=${emAndamento.session_id}`} block className="mt-4">
            <Play className="size-4" />
            Retomar treino
          </ButtonLink>
        </Card>
      ) : dia ? (
        <Card tone="primary">
          <p className="t-caption">{DIAS_DA_SEMANA[hojeSemana]}</p>
          <h2 className="t-title mt-0.5">{dia.nome}</h2>

          {plano.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {plano.map((item) => (
                <li
                  key={item.routine_exercise_id ?? item.exercise_id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">{item.nome}</span>
                  <span className="t-caption shrink-0 tabular-nums">{resumoDoItem(item)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-caption mt-2">
              Este dia ainda não tem exercício. Adicione na rotina, ou comece e monte na hora.
            </p>
          )}

          <Button block className="mt-4" onClick={() => comecar(plano)} disabled={iniciar.isPending}>
            <Play className="size-4" />
            Começar treino
          </Button>
        </Card>
      ) : (
        <Card>
          <p className="t-caption">{DIAS_DA_SEMANA[hojeSemana]}</p>
          <h2 className="t-title mt-0.5">Descanso</h2>
          {proximo ? (
            <p className="t-caption mt-1">
              Próximo: {DIAS_DA_SEMANA[proximo.dia_semana].toLowerCase()} · {proximo.nome}
            </p>
          ) : (
            <p className="t-caption mt-1">Sua rotina ainda não tem nenhum dia de treino.</p>
          )}
          <button
            type="button"
            onClick={() => comecar([])}
            disabled={iniciar.isPending}
            className="mt-3 min-h-11 text-[0.8125rem] font-medium text-primary"
          >
            Treinar mesmo assim
          </button>
        </Card>
      )}

      {recentes.length > 0 && (
        <div className="space-y-2">
          <SectionLabel
            action={
              <Link to="/treino/progresso" className="text-[0.8125rem] font-medium text-primary">
                Ver tudo
              </Link>
            }
          >
            Últimas sessões
          </SectionLabel>
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {recentes.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <CardRow as={Link} to={`/treino/sessao/${s.id}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.nome || "Sessão"}</span>
                      <span className="t-caption block">{dataRelativa(s.data)}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </CardRow>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Card padded={false}>
        <ul className="divide-y divide-border">
          {ATALHOS.map((a) => (
            <li key={a.to}>
              <CardRow as={Link} to={a.to}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <a.icone className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.label}</span>
                  <span className="t-caption block truncate">{a.sub}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </CardRow>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  );
}
