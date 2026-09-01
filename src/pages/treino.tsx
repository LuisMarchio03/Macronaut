import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronRight, Play, Plus } from "lucide-react";
import { Card, CardRow } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/page";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SheetTreinoAvulso } from "@/components/treino/sheet-treino-avulso";
import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton";
import { useDiasDaRotina, useRotinaAtiva } from "@/hooks/use-rotina";
import { useCriarSessao, usePlanoDoDia, useSessoesAbertas } from "@/hooks/use-sessao";
import { useListSessions } from "@/hooks/use-workouts";
import { proximoTreino, treinoDoDia } from "@/domain/prescricao";
import type { ItemPlanejado } from "@/repositories/sessao";
import { dataRelativa, diaSemana, hoje } from "@/lib/date";
import { DIAS_DA_SEMANA } from "./treino-rotina";

/**
 * Como o card de hoje descreve um exercício.
 *
 * Só as séries de trabalho entram: o 5/3/1 começa por três séries de
 * aquecimento, e resumir pela primeira linha do array prometia "5 × 32,5 kg"
 * para um treino que sobe até 67,5. Carga zero não é uma carga — é a ausência
 * de uma, e o card convida a defini-la em vez de mostrar "0 kg".
 *
 * Cardio sai antes de tudo isso: peso e reps são zero nele DE PROPÓSITO (ver
 * `planejarCardio`), então a leitura literal anunciava "definir carga" para
 * uma bicicleta que já está inteiramente definida — em minutos.
 */
function resumoDoItem(item: ItemPlanejado): string {
  const cardio = item.series.find((s) => s.duracao_min !== null);
  if (cardio) return `${cardio.duracao_min} min`;

  const trabalho = item.series.filter((s) => s.tipo !== "aquecimento");
  if (trabalho.length === 0) return "sem séries";

  const pesos = trabalho.map((s) => s.peso_kg);
  const maisPesada = Math.max(...pesos);
  const plural = trabalho.length === 1 ? "série" : "séries";
  if (maisPesada === 0) return `${trabalho.length} ${plural} · definir carga`;

  const cargaUnica = pesos.every((p) => p === maisPesada);
  const repsUnicas = trabalho.every((s) => s.reps_alvo === trabalho[0].reps_alvo);
  return cargaUnica && repsUnicas
    ? `${trabalho.length} × ${trabalho[0].reps_alvo} × ${maisPesada} kg`
    : `${trabalho.length} ${plural} · até ${maisPesada} kg`;
}

/**
 * O painel "Hoje": o que treinar agora, e nada mais.
 *
 * A lista de atalhos que morava no fim desta tela morreu com as abas — ela
 * existia para levar a "Rotina" e "Progresso", que hoje estão no topo, sempre
 * visíveis. Um destino repetido na mesma tela é uma decisão a mais para tomar.
 */
export function Treino() {
  const navigate = useNavigate();
  const data = hoje();
  const hojeSemana = diaSemana(data);

  const { data: rotina, isLoading } = useRotinaAtiva();
  const { data: dias = [] } = useDiasDaRotina(rotina);
  const dia = treinoDoDia(dias, hojeSemana);
  const proximo = proximoTreino(dias, hojeSemana);

  const { data: plano = [] } = usePlanoDoDia(dia?.id, data);
  const { data: abertas = [] } = useSessoesAbertas();
  const { data: recentes = [] } = useListSessions();
  const criar = useCriarSessao();
  const [pedindoNome, setPedindoNome] = useState(false);

  function comecar(itens: ItemPlanejado[], nome: string) {
    criar.mutate(
      { data, nome, itens },
      { onSuccess: (id) => navigate(`/treino/sessao?s=${id}`) },
    );
  }

  /**
   * Treinar fora da rotina, todo dia.
   *
   * Vivia só no ramo do dia de descanso, então num dia que tem rotina não
   * havia caminho nenhum para um treino extra — e com uma sessão aberta o card
   * só sabia oferecer "retomar".
   */
  const botaoAvulso = (
    <button
      type="button"
      onClick={() => setPedindoNome(true)}
      disabled={criar.isPending}
      className="flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary"
    >
      <Plus className="size-4" />
      Treino avulso
    </button>
  );

  if (isLoading) {
    return (
      <>
        <SkeletonCard />
        <SkeletonList rows={3} />
      </>
    );
  }

  return (
    <>
      {!rotina ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="Nenhuma rotina configurada"
            description="Diga ao app o que você treina em cada dia da semana. Depois é só abrir e seguir — a carga de cada exercício ele calcula sozinho, e sobe quando você bater a meta."
            action={<ButtonLink to="/treino/rotina">Montar rotina</ButtonLink>}
          />
        </Card>
      ) : abertas.length > 0 ? (
        /* Uma linha por sessão aberta: com o treino da rotina e um avulso da
           noite ao mesmo tempo, oferecer só a mais recente escondia a outra
           sem dizer que ela existia. */
        <>
          {abertas.map((s) => (
            <Card key={s.session_id} tone="primary">
              <p className="t-caption">Sessão em andamento</p>
              <h2 className="t-title mt-0.5">{s.nome ?? "Treino"}</h2>
              <p className="t-caption mt-1 tabular-nums">
                {s.total === 0
                  ? "sem exercício ainda"
                  : `${s.feitas} de ${s.total} séries`}
              </p>
              <ButtonLink to={`/treino/sessao?s=${s.session_id}`} block className="mt-4">
                <Play className="size-4" />
                Retomar treino
              </ButtonLink>
            </Card>
          ))}
          <div className="flex justify-center">{botaoAvulso}</div>
        </>
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

          <Button
            block
            className="mt-4"
            onClick={() => comecar(plano, dia.nome)}
            disabled={criar.isPending}
          >
            <Play className="size-4" />
            Começar treino
          </Button>
          <div className="mt-1 flex justify-center">{botaoAvulso}</div>
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
          <div className="mt-3">{botaoAvulso}</div>
        </Card>
      )}

      <SheetTreinoAvulso
        aberto={pedindoNome}
        onFechar={() => setPedindoNome(false)}
        pendente={criar.isPending}
        onComecar={(nome) => { setPedindoNome(false); comecar([], nome); }}
      />

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

    </>
  );
}
