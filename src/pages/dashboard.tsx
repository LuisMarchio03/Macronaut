import { Link } from "react-router-dom";
import {
  Bot, Dumbbell, Droplets, Zap, ChevronRight,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CalorieRing } from "@/components/calorie-ring";
import { MacroBars } from "@/components/macro-bars";
import { DateNav } from "@/components/date-nav";
import { useProfile } from "@/hooks/use-profile";
import { useMeals } from "@/hooks/use-meals";
import { useTodayEntries, useFoodsForEntries } from "@/hooks/use-today-entries";
import { useWaterToday } from "@/hooks/use-water-today";
import { useSessionByDate } from "@/hooks/use-workouts";
import { useAiConfig } from "@/hooks/use-ai-config";
import { totaisDoDia } from "@/domain/nutrition";
import { formatarData } from "@/lib/date";
import { useDataAtiva } from "@/lib/data-context";
import type { Macros } from "@/domain/types";

export function Dashboard() {
  const { data, ehHoje } = useDataAtiva();
  const perfil = useProfile();
  const { data: entries = [] } = useTodayEntries(data);
  const { data: foods } = useFoodsForEntries(entries);
  const { data: totalAgua = 0 } = useWaterToday(data);
  const { data: treinoHoje } = useSessionByDate(data);
  const { data: meals = [] } = useMeals();
  const { data: aiConfig } = useAiConfig();

  const iaDisponivel = aiConfig && (aiConfig.aloy_enabled || aiConfig.gemini_enabled);

  const meta: Macros = perfil.data
    ? {
        kcal: perfil.data.meta_kcal,
        prot_g: perfil.data.meta_prot_g,
        carb_g: perfil.data.meta_carb_g,
        gord_g: perfil.data.meta_gord_g,
      }
    : { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };

  const consumido: Macros = foods
    ? totaisDoDia(entries, foods)
    : { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };

  const pctKcal = meta.kcal > 0 ? Math.round((consumido.kcal / meta.kcal) * 100) : 0;
  const pctAgua = Math.min(100, (totalAgua / 3000) * 100);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const entriesHoje = entries.length;
  const totalKcalHoje = Math.round(consumido.kcal);
  const totalProtHoje = Math.round(consumido.prot_g);

  if (perfil.isLoading) {
    return (
      <div className="space-y-4 p-4">
        <SkeletonCard />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  if (!perfil.data) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<Zap className="size-6" />}
          title="Bem-vindo ao Macronaut"
          description="Configure suas metas para começar a acompanhar sua nutrição e treinos."
          action={
            <Link
              to="/metas"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80 active:scale-[0.97]"
            >
              Definir metas
              <ChevronRight className="size-4" />
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <header className="space-y-1 pt-2">
        <p className="section-title">
          {saudacao} · {ehHoje ? "Hoje" : formatarData(data)}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatarData(data)}
          </h1>
          {iaDisponivel && (
            <Link
              to="/ia"
              className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            >
              <Bot className="size-5" />
            </Link>
          )}
        </div>
        <div className="pt-1">
          <DateNav />
        </div>
      </header>

      {/* Calorias + Macros */}
      <SectionCard variant="gradient" header="Consumo" aside={`${pctKcal}% da meta`}>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="shrink-0">
            <CalorieRing consumido={consumido.kcal} meta={meta.kcal} />
          </div>
          <div className="min-w-0 flex-1 self-center sm:self-stretch sm:pt-4">
            <MacroBars consumido={consumido} meta={meta} />
          </div>
        </div>
      </SectionCard>

      {/* Quick Stats Grid */}
      <div className="stat-grid stat-grid-3">
        <StatCard
          variant="elevated"
          value={`${totalKcalHoje}`}
          label="kcal"
          sub={`meta ${Math.round(meta.kcal)}`}
          icon={<Zap className="size-5" />}
        />
        <StatCard
          variant="elevated"
          value={`${totalProtHoje}`}
          label="proteína (g)"
          sub={`meta ${Math.round(meta.prot_g)}g`}
        />
        <StatCard
          variant="elevated"
          value={`${Math.round(totalAgua / 100) / 10}L`}
          label="água"
          sub={`${pctAgua}% da meta`}
          icon={<Droplets className="size-5" />}
        />
      </div>

      {/* Treino de hoje */}
      <SectionCard
        variant="elevated"
        header="Treino"
        aside={treinoHoje ? `${treinoHoje.nome || "Sessão"}` : undefined}
      >
        {treinoHoje ? (
          <Link
            to="/treino"
            className="flex items-center gap-3 rounded-xl bg-primary/5 p-3 transition-colors hover:bg-primary/10"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Dumbbell className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">
                {treinoHoje.nome || "Treino registrado"}
              </span>
              <span className="block text-xs text-muted-foreground">
                Ver detalhes no módulo de treino
              </span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground/60" />
          </Link>
        ) : (
          <Link
            to="/treino"
            className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 transition-colors hover:bg-muted"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Dumbbell className="size-5" />
            </span>
            <span className="flex-1 text-left">
              <span className="block text-sm font-medium">Nenhum treino hoje</span>
              <span className="block text-xs text-muted-foreground">
                Ir para módulo de treino
              </span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground/60" />
          </Link>
        )}
      </SectionCard>

      {/* Últimas refeições - resumo */}
      <SectionCard variant="elevated" header={`Refeições (${entriesHoje} registro(s))`}>
        {entriesHoje > 0 ? (
          <ul className="divide-y divide-border/40 -mx-4 -mb-4">
            {meals.map((m) => {
              const kcalM = entries
                .filter((e) => e.meal_id === m.id)
                .reduce((s) => s + 1, 0);
              return kcalM > 0 ? (
                <li key={m.id}>
                  <Link
                    to="/nutricao"
                    className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{m.nome}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {kcalM} {kcalM === 1 ? "item" : "itens"}
                    </span>
                  </Link>
                </li>
              ) : null;
            })}
            <li>
              <Link
                to="/nutricao"
                className="flex items-center justify-center gap-1 px-4 py-3 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
              >
                Ver detalhes <ChevronRight className="size-3.5" />
              </Link>
            </li>
          </ul>
        ) : (
          <EmptyState
            title="Nada registrado hoje"
            description="Adicione alimentos para acompanhar sua nutrição"
            action={
              <Link
                to="/nutricao"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Adicionar alimentos
              </Link>
            }
          />
        )}
      </SectionCard>

      {/* Ações rápidas */}
      <div className="flex gap-2 pb-4">
        <Link
          to="/nutricao"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Zap className="size-4" /> Nutrição
        </Link>
        <Link
          to="/treino"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Dumbbell className="size-4" /> Treino
        </Link>
        <Link
          to="/analise"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Droplets className="size-4" /> Análise
        </Link>
      </div>
    </div>
  );
}