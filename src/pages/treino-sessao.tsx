import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CronometroDescanso } from "@/components/treino/cronometro-descanso";
import { ExercicioAutocomplete } from "@/components/treino/exercicio-autocomplete";
import { SheetAjustarSerie } from "@/components/treino/sheet-ajustar-serie";
import { useExercises } from "@/hooks/use-exercises";
import {
  useAdicionarAoPlano,
  useDesfazerSerie,
  usePlano,
  useRegistrarSerie,
  useSessaoEmAndamento,
} from "@/hooks/use-sessao";
import { useHistoricoExercicio } from "@/hooks/use-workouts";
import { planejar } from "@/domain/prescricao";
import { resumirSets } from "@/domain/treino";
import type { TipoSerie } from "@/domain/types";
import { hoje } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { PlanoSerie } from "@/repositories/sessao";

/** Exercício adicionado no meio do treino entra por dupla progressão, com os
 *  mesmos padrões da rotina — o ajuste da primeira série define a carga. */
const AVULSO = { series: 3, reps_min: 8, reps_max: 12, incremento_kg: 2.5 };

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

export function TreinoSessao() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const idDaUrl = params.get("s");
  const { data: emAndamento, isPending: carregandoSessao } = useSessaoEmAndamento(hoje());
  const sessionId = idDaUrl ? Number(idDaUrl) : (emAndamento?.session_id ?? undefined);

  const { data: plano = [], isPending: carregandoPlano } = usePlano(sessionId);
  const registrar = useRegistrarSerie();
  const desfazer = useDesfazerSerie();
  const adicionar = useAdicionarAoPlano();
  const { data: catalogo = [] } = useExercises();

  const [iExercicio, setIExercicio] = useState(0);
  const [ajustando, setAjustando] = useState<PlanoSerie | null>(null);
  const [adicionando, setAdicionando] = useState(false);
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

  const feitas = plano.filter((s) => s.set_id !== null).length;
  const atual = exercicios[Math.min(iExercicio, Math.max(exercicios.length - 1, 0))];
  const descanso = atual?.series[0]?.descanso_s ?? undefined;

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

  if (sessionId === undefined && (carregandoSessao || carregandoPlano)) {
    return (
      <div className="p-4">
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

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
          {emAndamento?.nome ?? "Treino"}
        </span>
        <span className="t-caption shrink-0 tabular-nums">
          {feitas}/{plano.length}
        </span>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        {atual ? (
          <>
            <div>
              <h1 className="t-title">{atual.nome}</h1>
              <UltimaVez exerciseId={atual.exercise_id} />
            </div>

            <ul className="space-y-2">
              {atual.series.map((s) => (
                <LinhaSerie
                  key={s.id}
                  s={s}
                  onRegistrar={() => registrarSerie(s)}
                  onDesfazer={() => desfazer.mutate(s.id)}
                  onAjustar={() => setAjustando(s)}
                />
              ))}
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
                  adicionar.mutate({
                    sessionId,
                    item: {
                      routine_exercise_id: null,
                      exercise_id: ex.id,
                      nome: ex.nome,
                      descanso_s: 90,
                      series: planejar({ tipo: "dupla", ...AVULSO, peso_inicial_kg: 0 }, []),
                    },
                  });
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
            const completo = b.series.every((s) => s.set_id !== null);
            return (
              <button
                key={b.exercise_id}
                type="button"
                onClick={() => setIExercicio(i)}
                aria-current={i === iExercicio}
                className={cn(
                  "min-h-11 shrink-0 rounded-lg px-3 text-[0.8125rem] font-medium transition-colors",
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
        <Button block size="lg" onClick={() => navigate("/treino")}>
          {plano.length > 0 && feitas === plano.length
            ? "Finalizar treino"
            : `Finalizar (${feitas} de ${plano.length})`}
        </Button>
      </footer>

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
