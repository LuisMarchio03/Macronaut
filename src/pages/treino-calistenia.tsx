import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { SkeletonList } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { LineChart } from "@/components/line-chart";
import {
  comoRelogio, SheetRegistrarCalistenia, type EscolhaDeExercicio,
} from "@/components/calistenia/sheet-registrar";
import { useProfile } from "@/hooks/use-profile";
import {
  JANELA_DE_HABITO_DIAS,
  useApagarMetaCalistenia,
  useApagarSerieCalistenia,
  useMetasCalistenia,
  useSalvarMetaCalistenia,
  useSeriesDoDia,
  useSeriesPorRange,
  useUsadosRecentemente,
} from "@/hooks/use-calistenia";
import {
  medidaDa, sequenciaDeDias, tendencia, totaisPorDia, totaisPorExercicio,
  type SerieAvulsa,
} from "@/domain/calistenia";
import { diasAtras, hoje } from "@/lib/date";

type Visao = "hoje" | "semana" | "metas";

const VISOES = [
  { valor: "hoje" as const, label: "Hoje" },
  { valor: "semana" as const, label: "Semana" },
  { valor: "metas" as const, label: "Metas" },
];

/** Quantas semanas anteriores formam a base da tendência. */
const SEMANAS_DE_BASE = 4;

/** "14:32" — a hora em que a série aconteceu, no fuso de quem registrou. */
function horaDaSerie(created_at: string): string {
  const d = new Date(created_at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "20 reps" ou "1:30" — a quantidade escrita como a medida dela pede. */
function quantidadeEscrita(s: SerieAvulsa): string {
  return medidaDa(s) === "segundos" ? comoRelogio(s.segundos ?? 0) : `${s.reps} reps`;
}

/**
 * A calistenia por inteiro: o dia cru, a semana medida e as metas.
 *
 * Vive dentro do `TreinoLayout` — o `PageHeader` com as abas é dele. Aqui é o
 * cabeçalho do conteúdo, no mesmo padrão do detalhe de uma sessão.
 */
export function TreinoCalistenia() {
  const [visao, setVisao] = useState<Visao>("hoje");
  const [registrando, setRegistrando] = useState<EscolhaDeExercicio | null | undefined>(undefined);

  const data = hoje();
  const { data: perfil } = useProfile();
  const pesoCorporal = perfil?.peso_kg ?? 0;

  const { data: doDia = [], isPending } = useSeriesDoDia(data);
  const { data: daSemana = [] } = useSeriesPorRange(diasAtras(data, 6), data);
  // A base da tendência: as quatro semanas ANTERIORES a esta, sem incluí-la.
  const { data: daBase = [] } = useSeriesPorRange(
    diasAtras(data, 7 + SEMANAS_DE_BASE * 7 - 1),
    diasAtras(data, 7),
  );
  const { data: usados = [] } = useUsadosRecentemente(diasAtras(data, JANELA_DE_HABITO_DIAS));
  const { data: metas = [] } = useMetasCalistenia();

  const apagarSerie = useApagarSerieCalistenia();
  const salvarMeta = useSalvarMetaCalistenia();
  const apagarMeta = useApagarMetaCalistenia();

  const [rascunhos, setRascunhos] = useState<Record<number, string>>({});

  if (isPending) return <SkeletonList rows={4} />;

  return (
    <>
      {/* Sem link de volta: isto é uma aba, não uma tela filha de "Hoje". O
          título também sai — a aba acesa já diz onde você está. */}
      <p className="t-caption">
        As séries soltas do dia. Contam no seu gasto de calorias, e não como dia de rotina.
      </p>

      <Segmented opcoes={VISOES} valor={visao} onChange={setVisao} rotulo="O que ver" />

      {visao === "hoje" && (
        <VisaoHoje
          series={doDia}
          onRegistrar={() => setRegistrando(null)}
          onApagar={(id) => apagarSerie.mutate(id)}
        />
      )}

      {visao === "semana" && (
        <VisaoSemana series={daSemana} base={daBase} pesoCorporal={pesoCorporal} hojeStr={data} />
      )}

      {visao === "metas" && (
        <VisaoMetas
          usados={usados}
          metas={metas}
          rascunhos={rascunhos}
          onRascunho={(id, v) => setRascunhos((r) => ({ ...r, [id]: v }))}
          onSalvar={(exerciseId, alvoDia) => salvarMeta.mutate({ exerciseId, alvoDia })}
          onRemover={(exerciseId) => apagarMeta.mutate(exerciseId)}
        />
      )}

      <SheetRegistrarCalistenia
        aberto={registrando !== undefined}
        onFechar={() => setRegistrando(undefined)}
        data={data}
        exercicioInicial={registrando ?? null}
      />
    </>
  );
}

/** O dia cru, com a hora de cada série. É o que dá confiança no total. */
function VisaoHoje({
  series,
  onRegistrar,
  onApagar,
}: {
  series: SerieAvulsa[];
  onRegistrar: () => void;
  onApagar: (id: number) => void;
}) {
  if (series.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhuma série registrada"
          description="Fez umas flexões agora há pouco? Registre — leva dois toques, e é o que faz o resto da tela existir."
          action={
            <Button onClick={onRegistrar}>
              <Plus className="size-4" /> Registrar série
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <Card header="Séries de hoje" aside={`${series.length}`} padded={false}>
        <ul className="divide-y divide-border">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
              <span className="t-caption w-11 shrink-0 tabular-nums">
                {horaDaSerie(s.created_at)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.nome}</span>
                <span className="t-caption block tabular-nums">
                  {quantidadeEscrita(s)}
                  {s.peso_extra_kg ? ` · +${s.peso_extra_kg} kg` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onApagar(s.id)}
                aria-label={`Excluir série de ${s.nome}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Button variant="outline" block onClick={onRegistrar}>
        <Plus className="size-4" /> Registrar série
      </Button>
    </>
  );
}

/** A semana medida: sequência, curva, e o que cada exercício somou. */
function VisaoSemana({
  series,
  base,
  pesoCorporal,
  hojeStr,
}: {
  series: SerieAvulsa[];
  base: SerieAvulsa[];
  pesoCorporal: number;
  hojeStr: string;
}) {
  const sequencia = sequenciaDeDias(
    series.concat(base).map((s) => s.data),
    hojeStr,
  );
  const porDia = totaisPorDia(series, pesoCorporal);
  const porExercicio = totaisPorExercicio(series, pesoCorporal);

  const dias = Array.from({ length: 7 }, (_, i) => diasAtras(hojeStr, 6 - i));
  const pontos = dias.map((d) => ({ x: d, y: Math.round(porDia.get(d)?.reps ?? 0) }));

  const repsDaSemana = series.reduce((acc, s) => acc + (s.reps ?? 0), 0);
  const repsDaBase = base.reduce((acc, s) => acc + (s.reps ?? 0), 0);
  const variacao = tendencia(repsDaSemana, repsDaBase / SEMANAS_DE_BASE);

  const kcal = [...porDia.values()].reduce((acc, t) => acc + t.kcal, 0);
  const volume = [...porDia.values()].reduce((acc, t) => acc + t.volume_kg, 0);

  if (series.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhuma série nos últimos 7 dias"
          description="A semana se mede com o que foi registrado. Comece por hoje."
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={sequencia} unit={sequencia === 1 ? "dia" : "dias"} label="Sequência" />
          <Stat value={Math.round(kcal)} unit="kcal" label="Gasto na semana" />
          <Stat
            value={Math.round(volume).toLocaleString("pt-BR")}
            unit="kg"
            label="Volume equivalente"
            hint="fração do seu peso × reps"
          />
        </div>
        {variacao !== null && (
          <p className="t-caption mt-3 tabular-nums">
            {variacao >= 0 ? "+" : ""}
            {Math.round(variacao)}% em repetições contra a média das {SEMANAS_DE_BASE} semanas
            anteriores.
          </p>
        )}
      </Card>

      <Card header="Repetições por dia">
        <LineChart
          pontos={pontos}
          unidade=" reps"
          msgVazia="Registre em mais de um dia para ver a curva."
        />
      </Card>

      <Card header="Por exercício" padded={false}>
        <ul className="divide-y divide-border">
          {porExercicio.map((t) => (
            <li key={t.exercise_id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t.nome}</span>
                <span className="t-caption block tabular-nums">
                  {t.nSeries} {t.nSeries === 1 ? "série" : "séries"} · recorde{" "}
                  {t.medida === "segundos" ? comoRelogio(t.recorde) : t.recorde}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {t.medida === "segundos" ? comoRelogio(t.quantidade) : t.quantidade}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/**
 * A meta diária de cada exercício que virou hábito.
 *
 * A lista sai do uso, não do catálogo: oferecer meta para 170 exercícios que
 * você nunca fez seria um formulário, não uma decisão.
 */
function VisaoMetas({
  usados,
  metas,
  rascunhos,
  onRascunho,
  onSalvar,
  onRemover,
}: {
  usados: { exercise_id: number; nome: string; medida: "reps" | "segundos" }[];
  metas: { exercise_id: number; alvo_dia: number }[];
  rascunhos: Record<number, string>;
  onRascunho: (exerciseId: number, valor: string) => void;
  onSalvar: (exerciseId: number, alvoDia: number) => void;
  onRemover: (exerciseId: number) => void;
}) {
  if (usados.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhum exercício para medir ainda"
          description="A meta nasce do que você já faz: registre uma série primeiro, e ela aparece aqui."
        />
      </Card>
    );
  }

  return (
    <Card header="Meta diária" padded={false}>
      <ul className="divide-y divide-border">
        {usados.map((u) => {
          const meta = metas.find((m) => m.exercise_id === u.exercise_id);
          const rascunho = rascunhos[u.exercise_id] ?? (meta ? String(meta.alvo_dia) : "");
          const alvo = Number(rascunho);
          const valido = Number.isFinite(alvo) && alvo > 0;

          return (
            <li key={u.exercise_id} className="space-y-2 px-4 py-3">
              <p className="truncate text-sm font-medium">{u.nome}</p>
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Meta diária de ${u.nome}`}
                  inputMode="numeric"
                  className="w-24 shrink-0"
                  placeholder={u.medida === "segundos" ? "segundos" : "reps"}
                  value={rascunho}
                  onChange={(e) => onRascunho(u.exercise_id, e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!valido}
                  aria-label={`Salvar meta de ${u.nome}`}
                  onClick={() => onSalvar(u.exercise_id, alvo)}
                >
                  Salvar
                </Button>
                {meta && (
                  <button
                    type="button"
                    aria-label={`Remover meta de ${u.nome}`}
                    onClick={() => onRemover(u.exercise_id)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
