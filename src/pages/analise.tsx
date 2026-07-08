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
import { META_AGUA_ML } from "../components/water-counter";
import { HudPanel } from "../components/ui/hud-panel";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { hoje, formatarData } from "../lib/date";
import type { Macros } from "../domain/types";

const META_ZERO: Macros = { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };

export function Analise() {
  const [gran, setGran] = useState<Granularidade>("semana");
  const [periodo, setPeriodo] = useState<Periodo>(() => rangeDoPeriodo("semana", hoje()));

  const { data } = useAnaliseNutricao(periodo.inicio, periodo.fim);
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

  const vazioTudo =
    diasComKcal === 0 && aguaPorDia.size === 0 && sessions.length === 0 &&
    treino.nSessoes === 0 && treino.sets.length === 0;
  const eyebrow = "font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground";

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-1">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-primary/70">Análise</p>
        <h1 className="text-2xl font-semibold tracking-tight">Análise</h1>
      </header>

      <SeletorPeriodo gran={gran} periodo={periodo} onChange={(g, p) => { setGran(g); setPeriodo(p); }} />

      <HudPanel label="Peso" aside={resumoPe.nRegistros > 0 ? `${resumoPe.nRegistros} pesagem(ns)` : undefined}>
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder="peso de hoje (kg)"
            aria-label="registrar peso"
            value={pesoInput}
            onChange={(e) => setPesoInput(e.target.value)}
          />
          <Button onClick={registrar} disabled={!(pesoN > 0) || registrarPeso.isPending}>
            Registrar
          </Button>
        </div>
        {resumoPe.nRegistros > 0 ? (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl tabular-nums">{Math.round(resumoPe.atual * 10) / 10}</span>
              <span className="text-sm text-muted-foreground">kg</span>
              <span className="ml-auto font-mono text-sm text-muted-foreground">
                Δ {resumoPe.variacao >= 0 ? "+" : "−"}{Math.abs(Math.round(resumoPe.variacao * 10) / 10)} kg
              </span>
            </div>
            <div className="mt-1 font-mono text-[0.72rem] tabular-nums text-muted-foreground">
              média {Math.round(resumoPe.media * 10) / 10} · min {Math.round(resumoPe.min * 10) / 10} · máx {Math.round(resumoPe.max * 10) / 10} kg
            </div>
            <div className="mt-3">
              <LineChart pontos={pontosPeso} unidade="kg" msgVazia="Registre pelo menos 2 pesagens para ver a curva." />
            </div>
          </>
        ) : (
          <p className={`mt-2 ${eyebrow}`}>Nenhuma pesagem neste período</p>
        )}
      </HudPanel>

      {!data ? (
        <HudPanel label="Análise">
          <p className={`py-8 text-center ${eyebrow}`}>Carregando…</p>
        </HudPanel>
      ) : vazioTudo ? (
        <HudPanel label="Análise">
          <p className={`py-8 text-center ${eyebrow}`}>Sem registros neste período</p>
        </HudPanel>
      ) : (
        <>
          {diasComKcal > 0 && (
            <>
              <HudPanel label="Média diária" aside={`${diasComKcal} de ${resumo.diasNoPeriodo} dias`}>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-3xl tabular-nums">{Math.round(resumo.mediaKcal)}</span>
                  <span className="text-sm text-muted-foreground">kcal / dia</span>
                  {meta.kcal > 0 && (
                    <span className="ml-auto font-mono text-sm text-primary">{resumo.aderenciaKcalPct}% da meta</span>
                  )}
                </div>
              </HudPanel>

              <HudPanel label="kcal por dia">
                <LineChart pontos={pontos} unidade="kcal" msgVazia="Registre alimentos para ver o gráfico." />
              </HudPanel>

              <HudPanel label="Macros médios vs meta">
                <MacroBars consumido={media} meta={meta} />
              </HudPanel>

              <HudPanel label="Dias" bodyClassName="p-2">
                <ul className="divide-y divide-border/40">
                  {diasRegistrados.map(([dia, m]) => (
                    <li key={dia} className="flex items-center justify-between px-2 py-2.5">
                      <span className="font-mono text-sm">{formatarData(dia)}</span>
                      <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">
                        {Math.round(m.kcal)} kcal · P {Math.round(m.prot_g)} · C {Math.round(m.carb_g)} · G {Math.round(m.gord_g)}
                      </span>
                    </li>
                  ))}
                </ul>
              </HudPanel>
            </>
          )}

          <HudPanel label="Água" aside={`${resumoAg.diasBateramMeta} dia(s) na meta`}>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl tabular-nums">{Math.round(resumoAg.mediaMl)}</span>
              <span className="text-sm text-muted-foreground">ml / dia</span>
              <span className="ml-auto font-mono text-sm text-muted-foreground">meta {META_AGUA_ML} ml</span>
            </div>
            <div className="mt-3">
              <LineChart pontos={pontosAgua} unidade="ml" msgVazia="Registre água para ver o gráfico." />
            </div>
          </HudPanel>

          <HudPanel label="Atividades">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="font-mono text-2xl tabular-nums">{Math.round(resumoAt.totalKcal)}</div>
                <div className={eyebrow}>kcal</div>
              </div>
              <div>
                <div className="font-mono text-2xl tabular-nums">{Math.round(resumoAt.totalMin)}</div>
                <div className={eyebrow}>min</div>
              </div>
              <div>
                <div className="font-mono text-2xl tabular-nums">{resumoAt.nSessoes}</div>
                <div className={eyebrow}>sessões</div>
              </div>
            </div>
          </HudPanel>

          <HudPanel label="Balanço energético">
            <div className="flex items-center justify-between font-mono text-sm tabular-nums">
              <span className="text-muted-foreground">ingerido <b className="text-foreground">{Math.round(balanco.ingerido)}</b></span>
              <span className="text-muted-foreground">gasto <b className="text-foreground">{Math.round(balanco.gasto)}</b></span>
              <span className={balanco.saldo >= 0 ? "text-primary" : "text-destructive"}>
                saldo <b>{balanco.saldo >= 0 ? "+" : "−"}{Math.abs(Math.round(balanco.saldo))}</b> kcal
              </span>
            </div>
          </HudPanel>

          <HudPanel label="Treino">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="font-mono text-2xl tabular-nums">{resumoTr.nSessoes}</div>
                <div className={eyebrow}>sessões</div>
              </div>
              <div>
                <div className="font-mono text-2xl tabular-nums">{Math.round(resumoTr.volumeTotal)}</div>
                <div className={eyebrow}>volume kg</div>
              </div>
              <div>
                <div className="font-mono text-2xl tabular-nums">{resumoTr.nSeries}</div>
                <div className={eyebrow}>séries</div>
              </div>
            </div>
            <div className="mt-3">
              <LineChart pontos={pontosVolume} unidade="kg" msgVazia="Registre treinos para ver o volume." />
            </div>
            {gruposVol.length > 0 && (
              <ul className="mt-3 space-y-1">
                {gruposVol.map(([g, v]) => (
                  <li key={g} className="flex items-center justify-between font-mono text-[0.72rem] tabular-nums">
                    <span className="text-muted-foreground">{g}</span>
                    <span>{Math.round(v)} kg</span>
                  </li>
                ))}
              </ul>
            )}
          </HudPanel>
        </>
      )}
    </div>
  );
}
