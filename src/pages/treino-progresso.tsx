import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardRow } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/page";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { LineChart } from "@/components/line-chart";
import {
  useExerciciosComHistorico,
  useSeriesPorGrupo,
  useSessoesComResumo,
} from "@/hooks/use-progresso";
import { useDiasDaRotina, useRotinaAtiva } from "@/hooks/use-rotina";
import { useSetsForExercise } from "@/hooks/use-workouts";
import { serieDeProgressao } from "@/domain/treino";
import { estadoDosDias, treinosPorSemana } from "@/domain/consistencia";
import { dataRelativa, formatarData, hoje } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { ExercicioComHistorico, SessaoResumida } from "@/repositories/progresso";

type Visao = "sessoes" | "exercicios" | "resumo";

const VISOES = [
  { valor: "sessoes" as const, label: "Sessões" },
  { valor: "exercicios" as const, label: "Exercícios" },
  { valor: "resumo" as const, label: "Resumo" },
];

const METRICAS = [
  { valor: "e1RM" as const, label: "1RM estimado" },
  { valor: "topPeso" as const, label: "Carga máxima" },
  { valor: "volume" as const, label: "Volume" },
];

/** O que a sessão diz de si mesma numa linha. */
function resumoDaSessao(s: SessaoResumida): string {
  const partes: string[] = [];
  if (s.series > 0) {
    partes.push(`${s.series} ${s.series === 1 ? "série" : "séries"}`);
    partes.push(`${Math.round(s.volume_kg).toLocaleString("pt-BR")} kg de volume`);
  }
  if (s.cardio > 0) partes.push(`${Math.round(s.kcal_cardio)} kcal de cardio`);
  // O achado B3: sem isto, uma sessão só com aquecimento não dizia nada.
  if (partes.length === 0 && s.aquecimento > 0) return "só aquecimento";
  if (partes.length === 0) return "nenhuma série registrada";
  return partes.join(" · ");
}

function VisaoSessoes() {
  const { data: sessoes = [], isPending } = useSessoesComResumo();
  if (isPending) return <SkeletonList rows={4} />;

  if (sessoes.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhuma sessão ainda"
          description="Os treinos que você concluir aparecem aqui, com séries, volume e o que foi feito em cada exercício."
        />
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <ul className="divide-y divide-border">
        {sessoes.map((s) => (
          <li key={s.id}>
            <CardRow as={Link} to={`/treino/sessao/${s.id}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.nome || "Sessão"}</span>
                <span className="t-caption block truncate tabular-nums">
                  {dataRelativa(s.data)} · {resumoDaSessao(s)}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </CardRow>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Um exercício da lista, que abre o gráfico na própria linha. */
function LinhaExercicio({ e }: { e: ExercicioComHistorico }) {
  const [aberto, setAberto] = useState(false);
  const [metrica, setMetrica] = useState<"e1RM" | "topPeso" | "volume">("e1RM");
  const { data: sets = [] } = useSetsForExercise(aberto ? e.exercise_id : undefined);

  const pontos = serieDeProgressao(sets).map((p) => ({
    x: formatarData(p.data),
    y: metrica === "e1RM" ? p.e1RM : metrica === "topPeso" ? p.topPeso : Math.round(p.volume),
  }));

  return (
    <li>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted"
      >
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.nome}</span>
          <span className="t-caption block truncate tabular-nums">
            {dataRelativa(e.ultima)} · {e.sessoes} {e.sessoes === 1 ? "sessão" : "sessões"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums">{e.melhor_peso_kg} kg</span>
          <span className="t-caption block tabular-nums">1RM ≈ {e.melhor_e1rm}</span>
        </span>
      </button>

      {aberto && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <Segmented
            opcoes={METRICAS}
            valor={metrica}
            onChange={setMetrica}
            rotulo={`Métrica de progressão de ${e.nome}`}
          />
          <LineChart pontos={pontos} unidade={metrica === "volume" ? "kg" : "kg"} />
        </div>
      )}
    </li>
  );
}

function VisaoExercicios() {
  const { data: exercicios = [], isPending } = useExerciciosComHistorico();
  if (isPending) return <SkeletonList rows={5} />;

  // Sem `<select>` e sem tela vazia esperando escolha: a lista é o conteúdo.
  if (exercicios.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhum exercício com histórico"
          description="Assim que você registrar séries, cada exercício aparece aqui com a evolução da carga e os recordes."
        />
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <ul className="divide-y divide-border">
        {exercicios.map((e) => (
          <LinhaExercicio key={e.exercise_id} e={e} />
        ))}
      </ul>
    </Card>
  );
}

function VisaoResumo() {
  const data = hoje();
  const { data: rotina } = useRotinaAtiva();
  const { data: dias = [] } = useDiasDaRotina(rotina);
  const { data: sessoes = [] } = useSessoesComResumo(200);

  const feitas = sessoes.map((s) => ({ data: s.data, day_id: s.day_id }));
  const semanas = treinosPorSemana(feitas, data, 4);
  const estado = estadoDosDias(
    dias.map((d) => ({ id: d.id, dia_semana: d.dia_semana, nome: d.nome })),
    feitas,
    data,
  );

  // A semana vai de domingo a sábado, como `dia_semana` da rotina.
  const inicioSemana = semanas.at(-1)?.inicio ?? data;
  const { data: grupos = [] } = useSeriesPorGrupo(inicioSemana, data);
  const maiorGrupo = Math.max(1, ...grupos.map((g) => g.series));
  const maxSemana = Math.max(1, dias.length, ...semanas.map((s) => s.treinos));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SectionLabel
          action={
            dias.length > 0 ? (
              <span className="t-caption tabular-nums">{dias.length}× por semana na rotina</span>
            ) : undefined
          }
        >
          Estou seguindo a rotina?
        </SectionLabel>
        <Card>
          <ul className="space-y-2">
            {semanas.map((s) => (
              <li key={s.inicio} className="flex items-center gap-3">
                <span className="t-caption w-20 shrink-0 tabular-nums">{formatarData(s.inicio)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      dias.length > 0 && s.treinos >= dias.length ? "bg-success" : "bg-primary",
                    )}
                    style={{ width: `${Math.min(100, (s.treinos / maxSemana) * 100)}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {s.treinos}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {estado.length > 0 && (
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {estado.map((e) => (
                <li key={e.dia.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm font-medium">{e.dia.nome}</span>
                  <span
                    className={cn(
                      "t-caption shrink-0 tabular-nums",
                      e.diasAtras !== null && e.diasAtras > 10 && "text-warning",
                    )}
                  >
                    {e.diasAtras === null
                      ? "nunca feito"
                      : e.diasAtras === 0
                        ? "hoje"
                        : `há ${e.diasAtras} ${e.diasAtras === 1 ? "dia" : "dias"}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="space-y-2">
        <SectionLabel>Estou treinando tudo? · séries desta semana</SectionLabel>
        <Card>
          {grupos.length === 0 ? (
            <p className="t-caption">Nenhuma série registrada nesta semana.</p>
          ) : (
            <ul className="space-y-2">
              {grupos.map((g) => (
                <li key={g.grupo} className="flex items-center gap-3">
                  <span className="t-caption w-24 shrink-0 truncate">{g.grupo}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(g.series / maiorGrupo) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {g.series}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * "O que eu já fiz".
 *
 * Funde o histórico e a progressão, que respondiam a mesma pergunta em duas
 * telas e duas linguagens — e obrigavam a adivinhar em qual delas procurar.
 */
export function TreinoProgresso() {
  const [visao, setVisao] = useState<Visao>("sessoes");

  return (
    <>
      {/* Sub-aba, não aba: as três respondem "o que eu já fiz" com o mesmo
          recorte de dados, e promovê-las a rota daria oito abas ao treino. */}
      <Segmented opcoes={VISOES} valor={visao} onChange={setVisao} rotulo="O que ver" />

      {visao === "sessoes" && <VisaoSessoes />}
      {visao === "exercicios" && <VisaoExercicios />}
      {visao === "resumo" && <VisaoResumo />}
    </>
  );
}
