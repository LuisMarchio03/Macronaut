import { useState } from "react";
import {
  type Granularidade, type Periodo, rangeDoPeriodo, listaDeDias, diasNoPeriodo,
} from "../domain/periodo";
import { totaisPorDia, resumoNutricional } from "../domain/analise-nutricao";
import { resumoAgua } from "../domain/analise-agua";
import { resumoAtividade, kcalGastaPorDia } from "../domain/analise-atividade";
import { balancoEnergetico } from "../domain/analise-balanco";
import { resumoTreino, volumePorDia, volumePorGrupo } from "../domain/analise-treino";
import { resumoPeso } from "../domain/analise-peso";
import { SeletorPeriodo } from "../components/seletor-periodo";
import { useAnaliseNutricao } from "../hooks/use-analise-nutricao";
import { useAnaliseAgua } from "../hooks/use-analise-agua";
import { useAnaliseAtividade } from "../hooks/use-analise-atividade";
import { useAnaliseTreino } from "../hooks/use-analise-treino";
import { useAnalisePeso, useRegistrarPeso } from "../hooks/use-analise-peso";
import { useProfile } from "../hooks/use-profile";
import { LineChart } from "../components/line-chart";
import { MacroBars } from "../components/macro-bars";
import { SectionCard } from "../components/ui/section-card";
import { StatCard } from "../components/ui/stat-card";
import { SkeletonCard } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { hoje, formatarData } from "../lib/date";
import type { Macros } from "../domain/types";

const META_ZERO: Macros = { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };
const META_AGUA_ML = 3000;

type TabKey = "nutricao" | "peso" | "atividade";

const TABS: { key: TabKey; label: string }[] = [
  { key: "nutricao", label: "Nutrição" },
  { key: "peso", label: "Peso" },
  { key: "atividade", label: "Atividade" },
];

function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/50 bg-card p-1">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
            active === t.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Analise() {
  const [tab, setTab] = useState<TabKey>("nutricao");
  const [gran, setGran] = useState<Granularidade>("semana");
  const [periodo, setPeriodo] = useState<Periodo>(() => rangeDoPeriodo("semana", hoje()));

  const { data, isLoading: loadingNutri } = useAnaliseNutricao(periodo.inicio, periodo.fim);
  const { data: aguaPorDia = new Map<string, number>() } = useAnaliseAgua(periodo.inicio, periodo.fim);
  const { data: sessions = [] } = useAnaliseAtividade(periodo.inicio, periodo.fim);
  const { data: treino = { nSessoes: 0, sets: [] } } = useAnaliseTreino(periodo.inicio, periodo.fim);
  const { data: pesagens = [] } = useAnalisePeso(periodo.inicio, periodo.fim);
  const registrarPeso = useRegistrarPeso();
  const [pesoInput, setPesoInput] = useState("");
  const { data: profile } = useProfile();

  const totais = data ? totaisPorDia(data.entries, data.foodsById) : new Map<string, Macros>();
  const meta: Macros = profile
    ? { kcal: profile.meta_kcal, prot_g: profile.meta_prot_g, carb_g: profile.meta_carb_g, gord_g: profile.meta_gord_g }
    : META_ZERO;
  const nDias = diasNoPeriodo(periodo);
  const resumo = resumoNutricional(totais, meta, nDias);
  const dias = listaDeDias(periodo);
  const pontos = dias.map((d) => ({ x: d, y: Math.round(totais.get(d)?.kcal ?? 0) }));
  const diasRegistrados = [...totais.entries()]
    .filter(([, m]) => m.kcal > 0)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const diasComKcal = diasRegistrados.length;

  const media: Macros = {
    kcal: resumo.mediaKcal, prot_g: resumo.mediaProt, carb_g: resumo.mediaCarb, gord_g: resumo.mediaGord,
  };

  const resumoAg = resumoAgua(aguaPorDia, META_AGUA_ML, nDias);
  const pontosAgua = dias.map((d) => ({ x: d, y: Math.round(aguaPorDia.get(d) ?? 0) }));
  const resumoAt = resumoAtividade(sessions, nDias);
  const ingeridaPorDia = new Map<string, number>(
    [...totais.entries()].map(([d, m]) => [d, m.kcal] as [string, number]),
  );
  const balanco = balancoEnergetico(ingeridaPorDia, kcalGastaPorDia(sessions));

  const resumoTr = resumoTreino(treino.sets, treino.nSessoes, nDias);
  const volDia = volumePorDia(treino.sets);
  const pontosVolume = dias.map((d) => ({ x: d, y: Math.round(volDia.get(d) ?? 0) }));
  const gruposVol = [...volumePorGrupo(treino.sets).entries()].sort((a, b) => b[1] - a[1]);

  const resumoPe = resumoPeso(pesagens);
  const pontosPeso = pesagens.map((p) => ({ x: p.data, y: p.peso_kg }));
  const pesoN = Number(pesoInput);
  function registrar() {
    if (pesoN > 0) {
      registrarPeso.mutate(pesoN);
      setPesoInput("");
    }
  }

  const vazioNutri = diasComKcal === 0 && aguaPorDia.size === 0;
  const vazioAtividade = sessions.length === 0 && treino.nSessoes === 0 && treino.sets.length === 0;

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-2">
        <p className="section-title">Análise</p>
        <h1 className="text-2xl font-semibold tracking-tight">Análise</h1>
      </header>

      <SeletorPeriodo gran={gran} periodo={periodo} onChange={(g, p) => { setGran(g); setPeriodo(p); }} />

      <TabBar active={tab} onChange={setTab} />

      {/* ─── Tab: Nutrição ─── */}
      {tab === "nutricao" && (
        loadingNutri ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : vazioNutri ? (
          <EmptyState
            title="Sem registros no período"
            description="Registre alimentos e água para ver análises nutricionais."
          />
        ) : (
          <div className="space-y-3">
            {diasComKcal > 0 && (
              <>
                <SectionCard variant="gradient" header="Média diária" aside={`${diasComKcal}/${resumo.diasNoPeriodo} dias`}>
                  <StatCard variant="flush" value={`${Math.round(resumo.mediaKcal)}`} label="kcal / dia" />
                  {meta.kcal > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, resumo.aderenciaKcalPct)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs tabular-nums text-primary">
                        {resumo.aderenciaKcalPct}% da meta
                      </span>
                    </div>
                  )}
                </SectionCard>

                <SectionCard variant="elevated" header="Calorias por dia">
                  <LineChart pontos={pontos} unidade="kcal" msgVazia="Registre alimentos para ver o gráfico." />
                </SectionCard>

                <SectionCard variant="elevated" header="Macros médios vs meta">
                  <MacroBars consumido={media} meta={meta} />
                </SectionCard>

                <SectionCard variant="elevated" header="Dias" bodyClassName="p-2">
                  <ul className="divide-y divide-border/40">
                    {diasRegistrados.map(([dia, m]) => (
                      <li key={dia} className="flex items-center justify-between px-2 py-2.5">
                        <span className="font-mono text-sm">{formatarData(dia)}</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {Math.round(m.kcal)} kcal · P{Math.round(m.prot_g)} · C{Math.round(m.carb_g)} · G{Math.round(m.gord_g)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </>
            )}

            <SectionCard variant="elevated" header="Água" aside={`${resumoAg.diasBateramMeta} dia(s) na meta`}>
              <div className="flex items-baseline gap-2">
                <span className="metric-value text-3xl">{Math.round(resumoAg.mediaMl)}</span>
                <span className="metric-label">ml / dia</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">meta {META_AGUA_ML} ml</span>
              </div>
              <div className="mt-3">
                <LineChart pontos={pontosAgua} unidade="ml" msgVazia="Registre água para ver o gráfico." />
              </div>
            </SectionCard>
          </div>
        )
      )}

      {/* ─── Tab: Peso ─── */}
      {tab === "peso" && (
        <div className="space-y-3">
          <SectionCard variant="gradient" header="Registrar peso">
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                placeholder="peso (kg)"
                aria-label="registrar peso"
                value={pesoInput}
                onChange={(e) => setPesoInput(e.target.value)}
              />
              <Button onClick={registrar} disabled={!(pesoN > 0) || registrarPeso.isPending}>
                Salvar
              </Button>
            </div>
          </SectionCard>

          {resumoPe.nRegistros > 0 ? (
            <>
              <div className="stat-grid stat-grid-3">
                <StatCard variant="elevated" value={`${Math.round(resumoPe.atual * 10) / 10}`} label="atual (kg)" />
                <StatCard variant="elevated" value={`${Math.round(resumoPe.media * 10) / 10}`} label="média (kg)" />
                <StatCard
                  variant="elevated"
                  value={`${resumoPe.variacao >= 0 ? "+" : ""}${Math.abs(Math.round(resumoPe.variacao * 10) / 10)}`}
                  label="variação (kg)"
                />
              </div>

              <SectionCard variant="elevated" header={`Evolução (${resumoPe.nRegistros} pesagens)`}>
                <LineChart pontos={pontosPeso} unidade="kg" msgVazia="Registre pelo menos 2 pesagens para ver a curva." />
              </SectionCard>
            </>
          ) : (
            <EmptyState
              title="Nenhuma pesagem registrada"
              description="Registre seu peso acima para começar a acompanhar."
            />
          )}
        </div>
      )}

      {/* ─── Tab: Atividade ─── */}
      {tab === "atividade" && (
        vazioAtividade ? (
          <EmptyState
            title="Sem atividades no período"
            description="Registre treinos e cardio para ver análises."
          />
        ) : (
          <div className="space-y-3">
            <div className="stat-grid stat-grid-3">
              <StatCard variant="elevated" value={`${Math.round(resumoAt.totalKcal)}`} label="kcal gastas" />
              <StatCard variant="elevated" value={`${Math.round(resumoAt.totalMin)}`} label="min totais" />
              <StatCard variant="elevated" value={`${resumoAt.nSessoes}`} label="sessões" />
            </div>

            <SectionCard variant="gradient" header="Balanço energético">
              <div className="flex items-center justify-between font-mono text-sm tabular-nums">
                <span className="text-muted-foreground">
                  ingerido <b className="text-foreground">{Math.round(balanco.ingerido)}</b>
                </span>
                <span className="text-muted-foreground">
                  gasto <b className="text-foreground">{Math.round(balanco.gasto)}</b>
                </span>
                <span className={balanco.saldo >= 0 ? "text-primary" : "text-destructive"}>
                  saldo <b>{balanco.saldo >= 0 ? "+" : "−"}{Math.abs(Math.round(balanco.saldo))}</b>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (balanco.ingerido / (balanco.gasto || 1)) * 100)}%`,
                    background: balanco.saldo >= 0 ? "var(--primary)" : "var(--destructive)",
                  }}
                />
              </div>
            </SectionCard>

            {treino.sets.length > 0 && (
              <>
                <div className="stat-grid stat-grid-3">
                  <StatCard variant="elevated" value={`${resumoTr.nSessoes}`} label="sessões" />
                  <StatCard variant="elevated" value={`${Math.round(resumoTr.volumeTotal)}`} label="volume (kg)" />
                  <StatCard variant="elevated" value={`${resumoTr.nSeries}`} label="séries" />
                </div>

                <SectionCard variant="elevated" header="Volume por dia">
                  <LineChart pontos={pontosVolume} unidade="kg" msgVazia="Registre treinos para ver o volume." />
                </SectionCard>

                {gruposVol.length > 0 && (
                  <SectionCard variant="elevated" header="Volume por grupo muscular">
                    <ul className="space-y-1.5">
                      {gruposVol.map(([g, v]) => (
                        <li key={g} className="flex items-center justify-between font-mono text-sm tabular-nums">
                          <span className="text-muted-foreground">{g}</span>
                          <span className="font-medium">{Math.round(v)} kg</span>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                )}
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}