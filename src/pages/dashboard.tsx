import { Link } from "react-router-dom";
import { Bot, Dumbbell, Droplets, ChevronRight, Target } from "lucide-react";
import { Card, CardRow } from "@/components/ui/card";
import { Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { Progress } from "@/components/ui/progress";
import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { EnergySummary } from "@/components/energy-summary";
import { DateNav } from "@/components/date-nav";
import { useProfile } from "@/hooks/use-profile";
import { useMeals } from "@/hooks/use-meals";
import { useTodayEntries, useFoodsForEntries } from "@/hooks/use-today-entries";
import { useWaterToday } from "@/hooks/use-water-today";
import { useSessionByDate } from "@/hooks/use-workouts";
import { useAiConfig } from "@/hooks/use-ai-config";
import { totaisDoDia, totaisPorRefeicao } from "@/domain/nutrition";
import { useDataAtiva } from "@/lib/data-context";
import type { Macros } from "@/domain/types";

const META_AGUA_ML = 3000;
const ZERO: Macros = { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };

export function Dashboard() {
  const { data, ehHoje } = useDataAtiva();
  const perfil = useProfile();
  const { data: entries = [] } = useTodayEntries(data);
  const { data: foods } = useFoodsForEntries(entries);
  const { data: totalAgua = 0 } = useWaterToday(data);
  const { data: treinoHoje } = useSessionByDate(data);
  const { data: meals = [] } = useMeals();
  const { data: aiConfig } = useAiConfig();

  const iaDisponivel = aiConfig?.aloy_enabled || aiConfig?.gemini_enabled;

  const meta: Macros = perfil.data
    ? {
        kcal: perfil.data.meta_kcal,
        prot_g: perfil.data.meta_prot_g,
        carb_g: perfil.data.meta_carb_g,
        gord_g: perfil.data.meta_gord_g,
      }
    : ZERO;

  const consumido: Macros = foods ? totaisDoDia(entries, foods) : ZERO;
  const porRefeicao = foods ? totaisPorRefeicao(entries, foods) : new Map();

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  if (perfil.isLoading) {
    return (
      <Page>
        <SkeletonCard />
        <SkeletonList rows={4} />
      </Page>
    );
  }

  if (!perfil.data) {
    return (
      <Page>
        <Card>
          <EmptyState
            icon={<Target className="size-6" />}
            title="Bem-vindo ao Macronaut"
            description="Configure suas metas para o app começar a acompanhar sua nutrição e seus treinos."
            action={
              <Button render={<Link to="/metas" />}>
                Definir metas
                <ChevronRight className="size-4" />
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  const refeicoesComRegistro = meals.filter((m) => (porRefeicao.get(m.id)?.kcal ?? 0) > 0);
  const avulsas = porRefeicao.get(null);

  return (
    <Page>
      {/* A data vive no seletor abaixo — repeti-la num título seria a mesma
          informação duas vezes na mesma dobra. */}
      <PageHeader
        eyebrow={ehHoje ? saudacao : "Consultando outro dia"}
        title="Resumo do dia"
        action={
          iaDisponivel && (
            <Button variant="ghost" size="icon" render={<Link to="/ia" aria-label="Abrir assistente" />}>
              <Bot className="size-5" />
            </Button>
          )
        }
      >
        <DateNav />
      </PageHeader>

      <Card tone="primary">
        <EnergySummary consumido={consumido} meta={meta} />
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-center gap-2">
            <Droplets className="size-4 text-macro-carb" />
            <span className="t-caption text-foreground">Hidratação</span>
          </span>
          <span className="t-caption tabular-nums">
            <span className="font-medium text-foreground">
              {(totalAgua / 1000).toFixed(1).replace(".", ",")} L
            </span>
            {" / "}
            {META_AGUA_ML / 1000} L
          </span>
        </div>
        <Progress
          value={totalAgua}
          max={META_AGUA_ML}
          tone="carb"
          size="sm"
          className="mt-2.5"
          label={`Água: ${totalAgua} de ${META_AGUA_ML} mililitros`}
        />
        {/* Antes: "41.66666666666667% DA META". */}
        <p className="t-caption mt-2 tabular-nums">
          {Math.round((totalAgua / META_AGUA_ML) * 100)}% da meta
        </p>
      </Card>

      <div className="space-y-2">
        <SectionLabel
          action={
            <Link to="/nutricao" className="text-[0.8125rem] font-medium text-primary">
              Ver tudo
            </Link>
          }
        >
          Refeições
        </SectionLabel>

        <Card padded={false}>
          {refeicoesComRegistro.length === 0 && !avulsas ? (
            <EmptyState
              title="Nada registrado ainda"
              description="Use o botão + para registrar o que você comeu."
            />
          ) : (
            <ul className="divide-y divide-border">
              {refeicoesComRegistro.map((m) => (
                <li key={m.id}>
                  <CardRow as={Link} to="/nutricao">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.nome}</span>
                    <span className="t-caption shrink-0 tabular-nums">
                      {Math.round(porRefeicao.get(m.id)!.kcal)} kcal
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </CardRow>
                </li>
              ))}
              {avulsas && (
                <li>
                  <CardRow as={Link} to="/nutricao">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">Avulsas</span>
                    <span className="t-caption shrink-0 tabular-nums">
                      {Math.round(avulsas.kcal)} kcal
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </CardRow>
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-2">
        <SectionLabel>Treino</SectionLabel>
        <Card padded={false}>
          <CardRow as={Link} to="/treino">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Dumbbell className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {treinoHoje ? treinoHoje.nome || "Treino registrado" : "Nenhum treino hoje"}
              </span>
              <span className="t-caption block truncate">
                {treinoHoje ? "Ver séries e cargas" : "Registrar uma sessão"}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </CardRow>
        </Card>
      </div>
    </Page>
  );
}
