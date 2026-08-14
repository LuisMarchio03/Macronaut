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
import { Card } from "../components/ui/card";
import { Page, PageHeader } from "../components/ui/page";
import { Progress } from "../components/ui/progress";
import { Segmented } from "../components/ui/segmented";
import { Stat } from "../components/ui/stat";
import { SkeletonCard } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { hoje, dataPorExtenso } from "../lib/date";
import type { Macros } from "../domain/types";

const META_ZERO: Macros = { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };

/** Uma casa decimal, com vírgula: 82.35 → "82,4". */
const arred = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const META_AGUA_ML = 3000;

type TabKey = "nutricao" | "peso" | "atividade";

const TABS = [
  { valor: "nutricao" as const, label: "Nutrição" },
  { valor: "peso" as const, label: "Peso" },
  { valor: "atividade" as const, label: "Atividade" },
];

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
    <Page>
      <PageHeader title="Análise" />

      <SeletorPeriodo gran={gran} periodo={periodo} onChange={(g, p) => { setGran(g); setPeriodo(p); }} />

      <Segmented opcoes={TABS} valor={tab} onChange={setTab} rotulo="O que analisar" />

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
                <Card
                  tone="primary"
                  header="Média diária"
                  aside={`${diasComKcal} de ${resumo.diasNoPeriodo} dias`}
                >
                  <Stat
                    value={Math.round(resumo.mediaKcal).toLocaleString("pt-BR")}
                    unit="kcal / dia"
                    label=""
                    size="lg"
                  />
                  {meta.kcal > 0 && (
                    <>
                      <Progress
                        value={resumo.aderenciaKcalPct}
                        max={100}
                        tone="primary"
                        size="sm"
                        className="mt-3"
                        label={`Aderência à meta de calorias: ${resumo.aderenciaKcalPct}%`}
                      />
                      <p className="t-caption mt-2 tabular-nums">
                        {resumo.aderenciaKcalPct}% da meta de {Math.round(meta.kcal)} kcal
                      </p>
                    </>
                  )}
                </Card>

                <Card header="Calorias por dia">
                  <LineChart pontos={pontos} unidade="kcal" msgVazia="Registre alimentos para ver o gráfico." />
                </Card>

                <Card header="Macros médios comparados à meta">
                  <MacroBars consumido={media} meta={meta} />
                </Card>

                <Card header="Dia a dia" padded={false}>
                  <ul className="divide-y divide-border">
                    {diasRegistrados.map(([dia, m]) => (
                      <li key={dia} className="px-4 py-2.5">
                        <span className="block text-sm font-medium">{dataPorExtenso(dia)}</span>
                        <span className="t-caption block tabular-nums">
                          {Math.round(m.kcal)} kcal · P {Math.round(m.prot_g)} · C{" "}
                          {Math.round(m.carb_g)} · G {Math.round(m.gord_g)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            )}

            <Card
              header="Água"
              aside={
                resumoAg.diasBateramMeta === 1
                  ? "1 dia na meta"
                  : `${resumoAg.diasBateramMeta} dias na meta`
              }
            >
              <div className="flex items-baseline justify-between gap-3">
                <Stat
                  value={Math.round(resumoAg.mediaMl).toLocaleString("pt-BR")}
                  unit="ml / dia"
                  label=""
                  size="lg"
                />
                <span className="t-caption shrink-0 tabular-nums">
                  meta {(META_AGUA_ML / 1000).toFixed(1).replace(".", ",")} L
                </span>
              </div>
              <div className="mt-3">
                <LineChart pontos={pontosAgua} unidade="ml" msgVazia="Registre água para ver o gráfico." />
              </div>
            </Card>
          </div>
        )
      )}

      {/* ─── Tab: Peso ─── */}
      {tab === "peso" && (
        <div className="space-y-3">
          <Card tone="primary" header="Registrar peso">
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
          </Card>

          {resumoPe.nRegistros > 0 ? (
            <>
              <Card>
                <div className="grid grid-cols-3 gap-3">
                  <Stat value={arred(resumoPe.atual)} unit="kg" label="atual" />
                  <Stat value={arred(resumoPe.media)} unit="kg" label="média" />
                  <Stat
                    value={`${resumoPe.variacao >= 0 ? "+" : "−"}${arred(Math.abs(resumoPe.variacao))}`}
                    unit="kg"
                    label="variação"
                  />
                </div>
              </Card>

              <Card
                header="Evolução"
                aside={resumoPe.nRegistros === 1 ? "1 pesagem" : `${resumoPe.nRegistros} pesagens`}
              >
                <LineChart pontos={pontosPeso} unidade="kg" msgVazia="Registre pelo menos 2 pesagens para ver a curva." />
              </Card>
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
            <Card>
              <div className="grid grid-cols-3 gap-3">
                <Stat value={Math.round(resumoAt.totalKcal)} unit="kcal" label="gastas" />
                <Stat value={Math.round(resumoAt.totalMin)} unit="min" label="em atividade" />
                <Stat value={resumoAt.nSessoes} label="sessões" />
              </div>
            </Card>

            <Card tone="primary" header="Balanço energético">
              <div className="grid grid-cols-3 gap-3">
                <Stat value={Math.round(balanco.ingerido)} unit="kcal" label="ingerido" />
                <Stat value={Math.round(balanco.gasto)} unit="kcal" label="gasto em atividade" />
                <Stat
                  value={`${balanco.saldo >= 0 ? "+" : "−"}${Math.abs(Math.round(balanco.saldo))}`}
                  unit="kcal"
                  label="saldo"
                  tone={balanco.saldo >= 0 ? "primary" : undefined}
                />
              </div>
              <Progress
                value={balanco.ingerido}
                max={balanco.gasto || balanco.ingerido || 1}
                tone={balanco.saldo >= 0 ? "primary" : "warning"}
                size="sm"
                className="mt-3"
                label={`Ingerido ${Math.round(balanco.ingerido)} kcal contra ${Math.round(balanco.gasto)} kcal gastos`}
              />
            </Card>

            {treino.sets.length > 0 && (
              <>
                <Card>
                  <div className="grid grid-cols-3 gap-3">
                    <Stat value={resumoTr.nSessoes} label="sessões" />
                    <Stat value={Math.round(resumoTr.volumeTotal).toLocaleString("pt-BR")} unit="kg" label="volume" />
                    <Stat value={resumoTr.nSeries} label="séries" />
                  </div>
                </Card>

                <Card header="Volume por dia">
                  <LineChart pontos={pontosVolume} unidade="kg" msgVazia="Registre treinos para ver o volume." />
                </Card>

                {gruposVol.length > 0 && (
                  <Card header="Volume por grupo muscular" padded={false}>
                    <ul className="divide-y divide-border">
                      {gruposVol.map(([g, v]) => (
                        <li key={g} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                          <span className="min-w-0 truncate">{g}</span>
                          <span className="shrink-0 font-medium tabular-nums">
                            {Math.round(v).toLocaleString("pt-BR")} kg
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            )}
          </div>
        )
      )}
    </Page>
  );
}