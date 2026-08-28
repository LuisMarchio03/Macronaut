import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, Ellipsis, Minus, Pencil, Plus, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CronometroDescanso } from "@/components/treino/cronometro-descanso";
import { ExercicioAutocomplete } from "@/components/treino/exercicio-autocomplete";
import { SheetAjustarCardio } from "@/components/treino/sheet-ajustar-cardio";
import { SheetAjustarSerie } from "@/components/treino/sheet-ajustar-serie";
import { SheetEditarExercicio } from "@/components/treino/sheet-editar-exercicio";
import { SheetExercicio } from "@/components/treino/sheet-exercicio";
import { useExercises } from "@/hooks/use-exercises";
import { useProfile } from "@/hooks/use-profile";
import {
  useAdicionarAoPlano,
  useAdicionarSerie,
  useDesfazerSerie,
  useMarcasAmrap,
  usePlano,
  useRegistrarCardio,
  useFinalizarSessao,
  useRegistrarSerie,
  useRemoverExercicioDaSessao,
  useRemoverSerie,
  useReordenarExerciciosDaSessao,
  useSessao,
  useSessaoEmAndamento,
  useTrocarExercicioDaSessao,
} from "@/hooks/use-sessao";
import { useHistoricoExercicio } from "@/hooks/use-workouts";
import { e1RMDaSerie, ehRecorde, recordeNoPeso } from "@/domain/531";
import { estimativaKcal, resumirSets } from "@/domain/treino";
import type { TipoSerie } from "@/domain/types";
import { hoje } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { PlanoSerie } from "@/repositories/sessao";
import { ehCardio } from "@/repositories/sessao";

function Bolinha({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
        ok ? "border-success bg-success text-white" : "border-input",
      )}
    >
      {ok && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}

/** "Última vez · 3×10 @ 40 kg" — o contexto que justifica a carga de hoje. */
function UltimaVez({ exerciseId }: { exerciseId: number }) {
  const { data: hist = [], isPending } = useHistoricoExercicio(exerciseId, hoje(), 1);
  if (isPending) return null;
  const ultima = hist[0];
  return (
    <p className="t-caption tabular-nums">
      {ultima && ultima.sets.length > 0
        ? `Última vez · ${resumirSets(ultima.sets)}`
        : "Primeira vez neste exercício"}
    </p>
  );
}

function LinhaSerie({
  s,
  onRegistrar,
  onDesfazer,
  onAjustar,
}: {
  s: PlanoSerie;
  onRegistrar: () => void;
  onDesfazer: () => void;
  onAjustar: () => void;
}) {
  const ok = s.set_id !== null;
  const detalhe =
    s.pct !== null ? `${s.pct}%` : s.reps_min !== null ? `${s.reps_min}–${s.reps_alvo}` : "";

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={ok ? onDesfazer : onRegistrar}
        aria-label={`${ok ? "Desfazer" : "Registrar"} série ${s.serie_ordem} de ${s.nome}`}
        className={cn(
          "flex min-h-16 flex-1 items-center gap-3 rounded-xl border px-4 text-left transition-colors",
          ok ? "border-success/40 bg-tint-success" : "border-border bg-card hover:bg-muted",
        )}
      >
        <Bolinha ok={ok} />
        <span className="flex-1 text-[0.9375rem] font-semibold tabular-nums">
          {ok ? s.reps_feitas : s.reps_alvo} × {ok ? s.peso_feito_kg : s.peso_kg} kg
        </span>
        <span className="t-caption shrink-0 tabular-nums">
          {detalhe}
          {s.amrap ? (detalhe ? " · máx" : "máx") : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={onAjustar}
        aria-label={`Ajustar série ${s.serie_ordem} de ${s.nome}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
      >
        <Pencil className="size-4" />
      </button>
    </li>
  );
}

/**
 * A série até a falha do 5/3/1.
 *
 * É a única série da sessão cujo número de repetições não está decidido de
 * antemão — todas as outras são confirmação, esta é medição. Por isso ela é a
 * única com contador, e por isso o recorde a bater aparece ANTES da série: é o
 * que o método usa como motivação, e depois já não serve para nada.
 */
function LinhaAmrap({
  s,
  onRegistrar,
  onDesfazer,
  onAjustar,
}: {
  s: PlanoSerie;
  onRegistrar: (reps: number) => void;
  onDesfazer: () => void;
  onAjustar: () => void;
}) {
  const { data: marcas = [] } = useMarcasAmrap(s.exercise_id);
  // Começa nas reps prescritas: é o mínimo, e quem faz o mínimo não deve
  // precisar mexer no contador.
  const [escolhidas, setEscolhidas] = useState<number | null>(null);
  const reps = escolhidas ?? s.reps_alvo;
  const ok = s.set_id !== null;
  const recorde = recordeNoPeso(marcas, s.peso_kg);
  const bateuRecorde = ehRecorde(marcas, s.peso_kg, reps);

  if (ok) {
    return (
      <li className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDesfazer}
          aria-label={`Desfazer série ${s.serie_ordem} de ${s.nome}`}
          className="flex min-h-16 flex-1 items-center gap-3 rounded-xl border border-success/40 bg-tint-success px-4 text-left"
        >
          <Bolinha ok />
          <span className="flex-1 text-[0.9375rem] font-semibold tabular-nums">
            {s.reps_feitas} × {s.peso_feito_kg} kg
          </span>
          <span className="t-caption shrink-0 tabular-nums">{s.pct}% · máx</span>
        </button>
        <button
          type="button"
          onClick={onAjustar}
          aria-label={`Ajustar série ${s.serie_ordem} de ${s.nome}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          <Pencil className="size-4" />
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-primary/40 bg-tint-primary p-4">
      <div className="flex items-center gap-3">
        <Bolinha ok={false} />
        <span className="flex-1 text-[0.9375rem] font-semibold tabular-nums">
          {s.reps_alvo}+ × {s.peso_kg} kg
        </span>
        <span className="t-caption tabular-nums">{s.pct}%</span>
      </div>

      <p className="t-caption mt-1">
        Máximo de repetições.{" "}
        {recorde !== null ? (
          <>
            Seu recorde neste peso: <strong>{recorde}</strong>
          </>
        ) : (
          "Primeira vez neste peso."
        )}
      </p>

      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setEscolhidas(Math.max(1, reps - 1))}
          aria-label="Menos uma repetição"
          className="flex size-12 items-center justify-center rounded-full border border-input transition-colors hover:bg-muted"
        >
          <Minus className="size-5" />
        </button>
        <span className="min-w-[3ch] text-center">
          <span className="block text-4xl font-bold tabular-nums">{reps}</span>
          <span className="t-caption block">reps</span>
        </span>
        <button
          type="button"
          onClick={() => setEscolhidas(reps + 1)}
          aria-label="Mais uma repetição"
          className="flex size-12 items-center justify-center rounded-full border border-input transition-colors hover:bg-muted"
        >
          <Plus className="size-5" />
        </button>
      </div>

      {bateuRecorde && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[0.8125rem] font-medium text-success">
          <Trophy className="size-4" aria-hidden />
          Novo recorde · 1RM estimado {e1RMDaSerie(s.peso_kg, reps)} kg
        </p>
      )}

      <Button
        block
        className="mt-3"
        onClick={() => onRegistrar(reps)}
        aria-label={`Registrar série ${s.serie_ordem} de ${s.nome}`}
      >
        <Check className="size-4" />
        Registrar série
      </Button>
    </li>
  );
}

/**
 * Um item de cardio: duração no lugar de reps e carga.
 *
 * As calorias saem do MET do exercício e do peso do perfil — a mesma conta que
 * a tela de cardio antiga fazia, para que registrar bike dentro do treino e
 * registrar bike avulso deem o mesmo número no balanço energético.
 */
function LinhaCardio({
  s,
  peso_kg,
  onRegistrar,
  onDesfazer,
  onAjustar,
}: {
  s: PlanoSerie;
  peso_kg: number | null;
  onRegistrar: (v: { duracao_min: number; kcal: number }) => void;
  onDesfazer: () => void;
  onAjustar: () => void;
}) {
  const ok = s.activity_id !== null;
  const duracao = s.duracao_min ?? 0;
  const kcal =
    peso_kg !== null && s.met !== null ? Math.round(estimativaKcal(s.met, peso_kg, duracao)) : 0;

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={ok ? onDesfazer : () => onRegistrar({ duracao_min: duracao, kcal })}
        aria-label={`${ok ? "Desfazer" : "Registrar"} ${s.nome}`}
        className={cn(
          "flex min-h-16 flex-1 items-center gap-3 rounded-xl border px-4 text-left transition-colors",
          ok ? "border-success/40 bg-tint-success" : "border-border bg-card hover:bg-muted",
        )}
      >
        <Bolinha ok={ok} />
        <span className="flex-1">
          <span className="block text-[0.9375rem] font-semibold tabular-nums">
            {ok ? s.duracao_feita_min : duracao} min
          </span>
          <span className="t-caption block tabular-nums">
            {ok
              ? `${Math.round(s.kcal_feita ?? 0)} kcal`
              : kcal > 0
                ? `≈ ${kcal} kcal`
                : "defina seu peso nas metas para estimar as calorias"}
          </span>
        </span>
      </button>
      {/* O mesmo escape que as séries de peso têm: hoje o treino pode não ter
          sido o que o plano dizia, e no cardio isso é a diferença entre uma
          kcal certa e uma inventada no balanço energético. */}
      <button
        type="button"
        onClick={onAjustar}
        aria-label={`Ajustar ${s.nome}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
      >
        <Pencil className="size-4" />
      </button>
    </li>
  );
}

/** Ritual, não decisão: recolhido por padrão, com o contador de quantas já foram. */
function BlocoAquecimento({
  series,
  onRegistrar,
  onDesfazer,
}: {
  series: PlanoSerie[];
  onRegistrar: (s: PlanoSerie) => void;
  onDesfazer: (s: PlanoSerie) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const feitas = series.filter((s) => s.set_id !== null).length;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex min-h-12 w-full items-center gap-2 px-4 text-left"
      >
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", aberto && "rotate-180")}
          aria-hidden
        />
        <span className="flex-1 text-sm font-medium">Aquecimento</span>
        <span className="t-caption tabular-nums">
          {feitas}/{series.length}
        </span>
      </button>
      {aberto && (
        <ul className="border-t border-border">
          {series.map((s) => {
            const ok = s.set_id !== null;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => (ok ? onDesfazer(s) : onRegistrar(s))}
                  aria-label={`${ok ? "Desfazer" : "Registrar"} aquecimento ${s.serie_ordem} de ${s.nome}`}
                  className="flex min-h-12 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-muted"
                >
                  <Bolinha ok={ok} />
                  <span className="flex-1 text-sm tabular-nums">
                    {s.reps_alvo} × {s.peso_kg} kg
                  </span>
                  <span className="t-caption tabular-nums">{s.pct}%</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TreinoSessao() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const idDaUrl = params.get("s");
  const { data: emAndamento, isPending: carregandoSessao } = useSessaoEmAndamento(hoje());
  const sessionId = idDaUrl ? Number(idDaUrl) : (emAndamento?.session_id ?? undefined);

  const { data: sessao } = useSessao(sessionId);
  const { data: plano = [], isPending: carregandoPlano } = usePlano(sessionId);
  const registrar = useRegistrarSerie();
  const desfazer = useDesfazerSerie();
  const adicionar = useAdicionarAoPlano();
  const finalizar = useFinalizarSessao();
  const registrarCardio = useRegistrarCardio();
  const removerExercicio = useRemoverExercicioDaSessao();
  const trocarExercicio = useTrocarExercicioDaSessao();
  const reordenarExercicios = useReordenarExerciciosDaSessao();
  const adicionarSerie = useAdicionarSerie();
  const removerSerie = useRemoverSerie();
  const { data: perfil } = useProfile();
  const { data: catalogo = [] } = useExercises();

  const [iExercicio, setIExercicio] = useState(0);
  const [ajustando, setAjustando] = useState<PlanoSerie | null>(null);
  const [ajustandoCardio, setAjustandoCardio] = useState<PlanoSerie | null>(null);
  const [vendoFicha, setVendoFicha] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [editandoExercicio, setEditandoExercicio] = useState(false);
  const [registros, setRegistros] = useState(0);

  // Blocos de exercício na ordem do plano. `ordem` é contígua por exercício,
  // então basta agrupar preservando a primeira aparição.
  const exercicios = useMemo(() => {
    const blocos: { exercise_id: number; nome: string; series: PlanoSerie[] }[] = [];
    for (const s of plano) {
      const ultimo = blocos.at(-1);
      if (ultimo && ultimo.exercise_id === s.exercise_id) ultimo.series.push(s);
      else blocos.push({ exercise_id: s.exercise_id, nome: s.nome, series: [s] });
    }
    return blocos;
  }, [plano]);

  const feitas = plano.filter((s) => s.set_id !== null || s.activity_id !== null).length;
  const atual = exercicios[Math.min(iExercicio, Math.max(exercicios.length - 1, 0))];
  const descanso = atual?.series[0]?.descanso_s ?? undefined;
  const doAtual = atual?.series ?? [];
  const cardio = doAtual.filter(ehCardio);
  const aquecimento = doAtual.filter((s) => !ehCardio(s) && s.tipo === "aquecimento");
  const trabalho = doAtual.filter((s) => !ehCardio(s) && s.tipo !== "aquecimento");

  function registrarSerie(
    s: PlanoSerie,
    v?: { reps: number; peso_kg: number; tipo: TipoSerie; rir: number | null; nota: string | null },
  ) {
    registrar.mutate({
      planId: s.id,
      reps: v?.reps ?? s.reps_alvo,
      peso_kg: v?.peso_kg ?? s.peso_kg,
      tipo: v?.tipo ?? s.tipo,
      rir: v?.rir ?? null,
      nota: v?.nota ?? null,
    });
    setRegistros((n) => n + 1);

    // Registrada a última série pendente do exercício, avança sozinho — é o
    // gesto que você faria de qualquer jeito.
    const bloco = exercicios.find((b) => b.exercise_id === s.exercise_id);
    const ultimaPendente = bloco?.series.filter((x) => x.set_id === null).length === 1;
    if (ultimaPendente && iExercicio < exercicios.length - 1) setIExercicio((i) => i + 1);
  }

  // A ordem destas três guardas importa. `usePlano(undefined)` fica `isPending`
  // para sempre — no Query v5 uma consulta desabilitada nunca sai de `pending` —
  // então esperar por ela antes de saber se existe sessão prendia a tela num
  // esqueleto eterno, e o estado "nenhum treino em andamento" era inalcançável.
  const esqueleto = (
    <div className="p-4">
      <div className="skeleton h-40 w-full" />
    </div>
  );

  // Só faz sentido esperar a sessão do dia quando a URL não trouxe uma.
  if (!idDaUrl && carregandoSessao) return esqueleto;

  if (sessionId === undefined) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[0.9375rem] font-semibold">Nenhum treino em andamento</p>
        <p className="t-caption max-w-[32ch]">
          Comece o treino de hoje pela tela de treino — o app monta a sessão a partir da sua rotina.
        </p>
        <Button onClick={() => navigate("/treino")}>Voltar ao treino</Button>
      </div>
    );
  }

  if (carregandoPlano) return esqueleto;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/treino")}
          aria-label="Sair da sessão"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="size-5" />
        </button>
        {/* A sessão da URL, não a em andamento de hoje: abrir `?s=` de uma
            sessão antiga rotulava a tela com o nome do treino de hoje. */}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {sessao?.nome ?? "Treino"}
        </span>
        <span className="t-caption shrink-0 tabular-nums">
          {feitas}/{plano.length}
        </span>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        {atual ? (
          <>
            <div>
              {/* O nome abre a ficha: "como faz isso mesmo?" é uma pergunta de
                  academia, e a resposta estava a quatro toques e uma tela de
                  distância — longe demais para quem está com a barra na mão. */}
              {/* O botão vive DENTRO do h1: o nome do exercício continua sendo
                  o título da tela para quem navega por cabeçalhos, e ganha a
                  ação sem deixar de ser o que é. */}
              <div className="flex items-start gap-2">
                <h1 className="t-title min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setVendoFicha(true)}
                    aria-label={`Ver ficha de ${atual.nome}`}
                    className="text-left"
                  >
                    {atual.nome}
                  </button>
                </h1>
                {/* Escolhi o exercício errado, ou quero uma série a mais: as
                    duas coisas acontecem DEPOIS de a sessão existir, e até
                    aqui não havia caminho nenhum para nenhuma delas. */}
                <button
                  type="button"
                  onClick={() => setEditandoExercicio(true)}
                  aria-label={`Editar exercício ${atual.nome}`}
                  className="-mt-1 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Ellipsis className="size-5" />
                </button>
              </div>
              <UltimaVez exerciseId={atual.exercise_id} />
            </div>

            {cardio.length > 0 && (
              <ul className="space-y-2">
                {cardio.map((s) => (
                  <LinhaCardio
                    key={s.id}
                    s={s}
                    peso_kg={perfil?.peso_kg ?? null}
                    onRegistrar={(v) => {
                      registrarCardio.mutate({ planId: s.id, ...v });
                      setRegistros((n) => n + 1);
                    }}
                    onDesfazer={() => desfazer.mutate(s.id)}
                    onAjustar={() => setAjustandoCardio(s)}
                  />
                ))}
              </ul>
            )}

            {aquecimento.length > 0 && (
              <BlocoAquecimento
                series={aquecimento}
                onRegistrar={(s) => registrarSerie(s)}
                onDesfazer={(s) => desfazer.mutate(s.id)}
              />
            )}

            <ul className="space-y-2">
              {trabalho.map((s) =>
                s.amrap ? (
                  <LinhaAmrap
                    key={s.id}
                    s={s}
                    onRegistrar={(reps) =>
                      registrarSerie(s, {
                        reps,
                        peso_kg: s.peso_kg,
                        tipo: s.tipo,
                        rir: null,
                        nota: null,
                      })
                    }
                    onDesfazer={() => desfazer.mutate(s.id)}
                    onAjustar={() => setAjustando(s)}
                  />
                ) : (
                  <LinhaSerie
                    key={s.id}
                    s={s}
                    onRegistrar={() => registrarSerie(s)}
                    onDesfazer={() => desfazer.mutate(s.id)}
                    onAjustar={() => setAjustando(s)}
                  />
                ),
              )}
            </ul>

            {registros > 0 && <CronometroDescanso chave={registros} segundos={descanso} />}
          </>
        ) : (
          <p className="t-caption">
            Esta sessão ainda não tem exercício nenhum. Adicione o primeiro abaixo.
          </p>
        )}

        <div className="rounded-xl border border-dashed border-border p-3">
          {adicionando ? (
            <div>
              <Label htmlFor="add-sessao">Exercício</Label>
              <ExercicioAutocomplete
                id="add-sessao"
                exercicios={catalogo}
                selecionado={null}
                onSelecionar={(ex) => {
                  // Só a id: quem monta o item é `montarItemAvulso`, que cruza
                  // o histórico do exercício (a carga de hoje sai dele) e sabe
                  // que "Bicicleta" tem que dar cardio, não três séries de
                  // bicicleta a zero quilo.
                  adicionar.mutate({ sessionId, exerciseId: ex.id, data: hoje() });
                  setAdicionando(false);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdicionando(true)}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 text-[0.8125rem] font-medium text-primary"
            >
              <Plus className="size-4" />
              Adicionar exercício
            </button>
          )}
        </div>
      </div>

      {exercicios.length > 1 && (
        <nav aria-label="Exercícios da sessão" className="flex gap-1.5 overflow-x-auto border-t border-border px-4 py-2">
          {exercicios.map((b, i) => {
            const completo = b.series.every((s) => s.set_id !== null || s.activity_id !== null);
            return (
              <button
                key={b.exercise_id}
                type="button"
                onClick={() => setIExercicio(i)}
                aria-current={i === iExercicio}
                className={cn(
                  "min-h-11 max-w-[45vw] shrink-0 truncate rounded-lg px-3 text-[0.8125rem] font-medium transition-colors",
                  i === iExercicio
                    ? "bg-primary text-primary-foreground"
                    : completo
                      ? "bg-tint-success text-success"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {b.nome}
              </button>
            );
          })}
        </nav>
      )}

      <footer className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-lg">
        <Button
          block
          size="lg"
          disabled={finalizar.isPending}
          onClick={() =>
            finalizar.mutate(sessionId, { onSuccess: () => navigate("/treino") })
          }
        >
          {plano.length > 0 && feitas === plano.length
            ? "Finalizar treino"
            : `Finalizar (${feitas} de ${plano.length})`}
        </Button>
      </footer>

      {atual && (
        <SheetEditarExercicio
          aberto={editandoExercicio}
          onFechar={() => setEditandoExercicio(false)}
          nome={atual.nome}
          totalDeExercicios={exercicios.length}
          posicao={exercicios.findIndex((b) => b.exercise_id === atual.exercise_id)}
          totalDeSeries={atual.series.length}
          catalogo={catalogo}
          onTrocar={(para) =>
            trocarExercicio.mutate({ sessionId, de: atual.exercise_id, para })
          }
          onMover={(delta) => {
            const ids = exercicios.map((b) => b.exercise_id);
            const i = ids.indexOf(atual.exercise_id);
            [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
            reordenarExercicios.mutate({ sessionId, exerciseIds: ids });
            // O bloco vai junto: quem move o exercício quer continuar nele.
            setIExercicio(i + delta);
          }}
          onAdicionarSerie={() =>
            adicionarSerie.mutate({ sessionId, exerciseId: atual.exercise_id })
          }
          onRemoverSerie={() => removerSerie.mutate(atual.series.at(-1)!.id)}
          onRemover={() => {
            removerExercicio.mutate({ sessionId, exerciseId: atual.exercise_id });
            // O índice atual passa a apontar para um bloco que não existe mais.
            setIExercicio((i) => Math.max(0, i - 1));
          }}
        />
      )}

      <SheetExercicio
        aberto={vendoFicha}
        onFechar={() => setVendoFicha(false)}
        exercicio={catalogo.find((e) => e.id === atual?.exercise_id) ?? null}
      />

      <SheetAjustarCardio
        aberto={ajustandoCardio !== null}
        onFechar={() => setAjustandoCardio(null)}
        serie={ajustandoCardio}
        peso_kg={perfil?.peso_kg ?? null}
        onRegistrar={(v) => {
          if (!ajustandoCardio) return;
          registrarCardio.mutate({ planId: ajustandoCardio.id, ...v });
          setRegistros((n) => n + 1);
        }}
      />

      <SheetAjustarSerie
        aberto={ajustando !== null}
        onFechar={() => setAjustando(null)}
        serie={ajustando}
        onRegistrar={(v) => {
          if (ajustando) registrarSerie(ajustando, v);
        }}
      />
    </div>
  );
}
