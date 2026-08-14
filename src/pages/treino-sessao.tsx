import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Minus, Plus, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CronometroDescanso } from "@/components/treino/cronometro-descanso";
import {
  useConcluirSessao,
  useLevantamentos,
  useMarcasAmrap,
  usePosicao,
  useProgramaAtivo,
} from "@/hooks/use-programa";
import {
  ehRecorde,
  nomeDaSemana,
  recordeNoPeso,
  sessaoPrescrita,
  e1RMDaSerie,
  type SeriePrescrita,
} from "@/domain/531";
import { hoje } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { SerieRegistrada } from "@/repositories/programa";

/** Reps efetivamente feitas em cada série, indexadas pela posição na sessão. */
type Feitas = Record<number, number>;

export function TreinoSessao() {
  const navigate = useNavigate();
  const { data: programa, isLoading } = useProgramaAtivo();
  const { data: posicao } = usePosicao(programa);
  const { data: lifts = [] } = useLevantamentos(programa);
  const lift = posicao?.levantamento ?? null;
  const { data: marcas = [] } = useMarcasAmrap(lift?.exercise_id);
  const concluir = useConcluirSessao();

  const [feitas, setFeitas] = useState<Feitas>({});
  const [aquecimentoAberto, setAquecimentoAberto] = useState(false);
  const [repsAmrap, setRepsAmrap] = useState<number | null>(null);
  const [registros, setRegistros] = useState(0);

  const sessao = useMemo(
    () =>
      lift && posicao && programa
        ? sessaoPrescrita(lift.tm_kg, posicao.semana, programa.incremento_kg)
        : [],
    [lift, posicao, programa],
  );

  const iAmrap = sessao.findIndex((s) => s.amrap);
  const amrap = iAmrap >= 0 ? sessao[iAmrap] : null;
  const recorde = amrap ? recordeNoPeso(marcas, amrap.peso_kg) : null;

  // A AMRAP começa nas reps prescritas: é o mínimo, e quem faz o mínimo não
  // deve precisar mexer no contador.
  const reps = repsAmrap ?? amrap?.reps ?? 0;
  const bateuRecorde = amrap ? ehRecorde(marcas, amrap.peso_kg, reps) : false;

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  if (!programa || !lift || !posicao) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[0.9375rem] font-semibold">Nenhum programa configurado</p>
        <p className="t-caption max-w-[32ch]">
          Configure seus levantamentos e os Training Max para o app montar as sessões.
        </p>
        <Button onClick={() => navigate("/treino/programa")}>Configurar programa</Button>
      </div>
    );
  }

  const trabalho = sessao.filter((s) => s.tipo === "trabalho");
  const aquecimento = sessao.filter((s) => s.tipo === "aquecimento");
  const indiceDe = (s: SeriePrescrita) => sessao.indexOf(s);
  const marcar = (i: number, r: number) => {
    setFeitas((f) => ({ ...f, [i]: r }));
    setRegistros((n) => n + 1);
  };
  const desmarcar = (i: number) =>
    setFeitas((f) => {
      const { [i]: _fora, ...resto } = f;
      return resto;
    });

  const feitasDeTrabalho = trabalho.filter((s) => feitas[indiceDe(s)] !== undefined).length;
  const tudoFeito = feitasDeTrabalho === trabalho.length;
  const ordemNoLift = lifts.findIndex((l) => l.id === lift.id) + 1;

  function finalizar() {
    const series: SerieRegistrada[] = sessao
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => feitas[i] !== undefined)
      .map(({ s, i }, ordem) => ({
        exercise_id: lift!.exercise_id,
        ordem: ordem + 1,
        reps: feitas[i],
        peso_kg: s.peso_kg,
        tipo: s.tipo === "aquecimento" ? ("aquecimento" as const) : ("valida" as const),
        prescribed_pct: s.pct,
        amrap: s.amrap,
      }));

    concluir.mutate(
      {
        programId: programa!.id,
        liftId: lift!.id,
        ciclo: posicao!.ciclo,
        semana: posicao!.semana,
        tm_kg: lift!.tm_kg,
        data: hoje(),
        nome: `${lift!.nome} · ciclo ${posicao!.ciclo} semana ${posicao!.semana}`,
        series,
      },
      { onSuccess: () => navigate("/treino") },
    );
  }

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
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          Ciclo {posicao.ciclo} · semana {posicao.semana}
          <span className="t-caption ml-2">{nomeDaSemana(posicao.semana)}</span>
        </span>
        <span className="t-caption shrink-0 tabular-nums">
          {ordemNoLift}/{lifts.length}
        </span>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        <div>
          <h1 className="t-title">{lift.nome}</h1>
          <p className="t-caption mt-0.5 tabular-nums">Training Max {lift.tm_kg} kg</p>
        </div>

        {aquecimento.length > 0 && (
          <div className="rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setAquecimentoAberto((v) => !v)}
              aria-expanded={aquecimentoAberto}
              className="flex min-h-12 w-full items-center gap-2 px-4 text-left"
            >
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform", aquecimentoAberto && "rotate-180")}
                aria-hidden
              />
              <span className="flex-1 text-sm font-medium">Aquecimento</span>
              <span className="t-caption tabular-nums">
                {aquecimento.filter((s) => feitas[indiceDe(s)] !== undefined).length}/
                {aquecimento.length}
              </span>
            </button>
            {aquecimentoAberto && (
              <ul className="border-t border-border">
                {aquecimento.map((s) => {
                  const i = indiceDe(s);
                  const ok = feitas[i] !== undefined;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => (ok ? desmarcar(i) : marcar(i, s.reps))}
                        aria-pressed={ok}
                        className="flex min-h-12 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-muted"
                      >
                        <Bolinha ok={ok} />
                        <span className="flex-1 text-sm tabular-nums">
                          {s.reps} × {s.peso_kg} kg
                        </span>
                        <span className="t-caption tabular-nums">{s.pct}%</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <ul className="space-y-2">
          {trabalho.map((s) => {
            const i = indiceDe(s);
            const ok = feitas[i] !== undefined;

            if (s.amrap) {
              return (
                <li
                  key={i}
                  className={cn(
                    "rounded-xl border p-4",
                    ok ? "border-success/40 bg-tint-success" : "border-primary/40 bg-tint-primary",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Bolinha ok={ok} />
                    <span className="flex-1 text-[0.9375rem] font-semibold tabular-nums">
                      {ok ? feitas[i] : `${s.reps}+`} × {s.peso_kg} kg
                    </span>
                    <span className="t-caption tabular-nums">{s.pct}%</span>
                  </div>

                  {!ok && (
                    <>
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
                          onClick={() => setRepsAmrap(Math.max(1, reps - 1))}
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
                          onClick={() => setRepsAmrap(reps + 1)}
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

                      <Button block className="mt-3" onClick={() => marcar(i, reps)}>
                        <Check className="size-4" />
                        Registrar série
                      </Button>
                    </>
                  )}

                  {ok && (
                    <button
                      type="button"
                      onClick={() => desmarcar(i)}
                      className="mt-2 text-[0.8125rem] font-medium text-primary"
                    >
                      Desfazer
                    </button>
                  )}
                </li>
              );
            }

            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => (ok ? desmarcar(i) : marcar(i, s.reps))}
                  aria-pressed={ok}
                  aria-label={`${s.reps} repetições com ${s.peso_kg} quilos, ${s.pct} por cento`}
                  className={cn(
                    "flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 text-left transition-colors",
                    ok ? "border-success/40 bg-tint-success" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <Bolinha ok={ok} />
                  <span className="flex-1 text-[0.9375rem] font-semibold tabular-nums">
                    {s.reps} × {s.peso_kg} kg
                  </span>
                  <span className="t-caption tabular-nums">{s.pct}%</span>
                </button>
              </li>
            );
          })}
        </ul>

        {registros > 0 && <CronometroDescanso chave={registros} />}
      </div>

      <footer className="sticky bottom-0 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-lg">
        <Button
          block
          size="lg"
          disabled={feitasDeTrabalho === 0 || concluir.isPending}
          onClick={finalizar}
        >
          {concluir.isPending
            ? "Salvando…"
            : tudoFeito
              ? "Finalizar treino"
              : `Finalizar (${feitasDeTrabalho} de ${trabalho.length})`}
        </Button>
      </footer>
    </div>
  );
}

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
