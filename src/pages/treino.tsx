import { Link } from "react-router-dom";
import {
  ChevronRight,
  ClipboardList,
  Dumbbell,
  HeartPulse,
  History,
  Play,
  TrendingUp,
} from "lucide-react";
import { Card, CardRow } from "@/components/ui/card";
import { Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton";
import { useLevantamentos, usePosicao, useProgramaAtivo, useSessoesDoPrograma } from "@/hooks/use-programa";
import { useListSessions } from "@/hooks/use-workouts";
import { ehDeload, nomeDaSemana, seriesDeTrabalho, sessaoPrescrita } from "@/domain/531";
import { dataPorExtenso, dataRelativa } from "@/lib/date";

const ATALHOS = [
  { to: "/treino/programa", icone: ClipboardList, label: "Programa", sub: "Levantamentos e Training Max" },
  { to: "/treino/progressao", icone: TrendingUp, label: "Progressão", sub: "Gráficos e recordes" },
  { to: "/treino/historico", icone: History, label: "Histórico", sub: "Sessões anteriores" },
  { to: "/treino/exercicios", icone: Dumbbell, label: "Exercícios", sub: "Biblioteca" },
  { to: "/treino/cardio", icone: HeartPulse, label: "Cardio", sub: "Corrida, bike, caminhada" },
];

export function Treino() {
  const { data: programa, isLoading } = useProgramaAtivo();
  const { data: posicao } = usePosicao(programa);
  const { data: lifts = [] } = useLevantamentos(programa);
  const { data: doPrograma = [] } = useSessoesDoPrograma(programa);
  const { data: recentes = [] } = useListSessions();

  const lift = posicao?.levantamento ?? null;
  const prescrito =
    lift && posicao && programa
      ? seriesDeTrabalho(sessaoPrescrita(lift.tm_kg, posicao.semana, programa.incremento_kg))
      : [];

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
      <PageHeader eyebrow={dataPorExtenso(new Date().toISOString().slice(0, 10))} title="Treino" />

      {programa && lift && posicao ? (
        <Card tone="primary">
          <p className="t-caption">
            Ciclo {posicao.ciclo} · semana {posicao.semana} · {nomeDaSemana(posicao.semana)}
          </p>
          <h2 className="t-title mt-0.5">{lift.nome}</h2>

          <ul className="mt-3 space-y-1">
            {prescrito.map((s, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
                <span>
                  {s.reps}
                  {s.amrap && "+"} × {s.peso_kg} kg
                </span>
                <span className="t-caption">{s.pct}%</span>
              </li>
            ))}
          </ul>

          {ehDeload(posicao.semana) && (
            <p className="t-caption mt-2">Semana de deload: leve, sem série até a falha.</p>
          )}

          <ButtonLink to="/treino/sessao" block className="mt-4">
            <Play className="size-4" />
            Começar treino
          </ButtonLink>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="Nenhum programa configurado"
            description="Informe seus levantamentos e os Training Max. O app monta cada sessão do 5/3/1 a partir daí — você só confirma as séries."
            action={<ButtonLink to="/treino/programa">Configurar programa</ButtonLink>}
          />
        </Card>
      )}

      {programa && lifts.length > 0 && (
        <div className="space-y-2">
          <SectionLabel action={<span className="t-caption">{doPrograma.length} sessões</span>}>
            Seus levantamentos
          </SectionLabel>
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {lifts.map((l) => (
                <li key={l.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm font-medium">{l.nome}</span>
                  <span className="t-caption shrink-0 tabular-nums">TM {l.tm_kg} kg</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {recentes.length > 0 && (
        <div className="space-y-2">
          <SectionLabel
            action={
              <Link to="/treino/historico" className="text-[0.8125rem] font-medium text-primary">
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
                  <CardRow as={Link} to="/treino/historico">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {s.nome || "Sessão"}
                      </span>
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
