import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BackLink, Page, PageHeader } from "@/components/ui/page";
import { SkeletonList } from "@/components/ui/skeleton";
import { SheetAjustarSerie } from "@/components/treino/sheet-ajustar-serie";
import { usePlano, useRegistrarSerie } from "@/hooks/use-sessao";
import { useDeleteSession, useSessionSets, useUpdateSet } from "@/hooks/use-workouts";
import { useExercises } from "@/hooks/use-exercises";
import { useSessoesComResumo } from "@/hooks/use-progresso";
import { seriesEfetivas, resumirSets } from "@/domain/treino";
import { dataPorExtenso } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { PlanoSerie } from "@/repositories/sessao";
import type { WorkoutSet } from "@/domain/types";

/** Uma linha do detalhe: o que era para ser, ao lado do que foi. */
function LinhaComparada({ s, onEditar }: { s: PlanoSerie; onEditar: () => void }) {
  const feita = s.set_id !== null || s.activity_id !== null;
  const cardio = s.duracao_min !== null;

  const prescrito = cardio ? `${s.duracao_min} min` : `${s.reps_alvo} × ${s.peso_kg} kg`;
  const realizado = cardio
    ? `${s.duracao_feita_min} min · ${Math.round(s.kcal_feita ?? 0)} kcal`
    : `${s.reps_feitas} × ${s.peso_feito_kg} kg`;

  const divergiu =
    feita &&
    !cardio &&
    (s.reps_feitas !== s.reps_alvo || s.peso_feito_kg !== s.peso_kg);

  return (
    <li className="flex items-center gap-2 pr-2 pl-4">
      <span className="t-caption w-5 shrink-0 tabular-nums">{s.serie_ordem}</span>
      <span className={cn("min-w-0 flex-1 py-2", !feita && "opacity-45")}>
        <span className="block text-sm font-medium tabular-nums">
          {feita ? realizado : prescrito}
        </span>
        <span className="t-caption block tabular-nums">
          {!feita
            ? "não feita"
            : divergiu
              ? `prescrito ${prescrito}`
              : cardio
                ? "como planejado"
                : `${s.pct !== null ? `${s.pct}%` : "como planejado"}`}
        </span>
      </span>
      {!cardio && (
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar série ${s.serie_ordem} de ${s.nome}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          <Pencil className="size-4" />
        </button>
      )}
    </li>
  );
}

/**
 * Sessão anterior a esta arquitetura: não tem plano, só o realizado.
 *
 * Mostrar uma coluna de "prescrito" vazia seria fingir que o app sabe o que
 * era para ser — e ele não sabe.
 */
function SemPlano({ sets, exercicios }: { sets: WorkoutSet[]; exercicios: { id: number; nome: string }[] }) {
  const nomeDe = (id: number) => exercicios.find((e) => e.id === id)?.nome ?? "?";
  const porExercicio = [...new Set(sets.map((s) => s.exercise_id))];

  return (
    <>
      <Card>
        <p className="t-caption">
          Esta sessão é anterior ao plano de treino, então só existe o que foi feito — o app não
          sabe o que era para ser.
        </p>
      </Card>
      {porExercicio.map((id) => {
        const efetivas = seriesEfetivas(sets.filter((s) => s.exercise_id === id));
        if (efetivas.length === 0) return null;
        return (
          <Card key={id} header={nomeDe(id)}>
            <p className="text-sm tabular-nums">{resumirSets(efetivas)}</p>
          </Card>
        );
      })}
    </>
  );
}

export function TreinoSessaoDetalhe() {
  const navigate = useNavigate();
  const { id } = useParams();
  const sessionId = id ? Number(id) : undefined;

  const { data: plano = [], isPending: carregandoPlano } = usePlano(sessionId);
  const { data: sets = [] } = useSessionSets(sessionId);
  const { data: exercicios = [] } = useExercises();
  const { data: sessoes = [] } = useSessoesComResumo(200);
  const registrar = useRegistrarSerie();
  const atualizarSet = useUpdateSet(sessionId);
  const excluir = useDeleteSession();

  const [editando, setEditando] = useState<PlanoSerie | null>(null);
  const sessao = sessoes.find((s) => s.id === sessionId);

  if (carregandoPlano) {
    return (
      <Page>
        <SkeletonList rows={4} />
      </Page>
    );
  }

  // Blocos por exercício, na ordem do plano.
  const blocos: { exercise_id: number; nome: string; series: PlanoSerie[] }[] = [];
  for (const s of plano) {
    const ultimo = blocos.at(-1);
    if (ultimo && ultimo.exercise_id === s.exercise_id) ultimo.series.push(s);
    else blocos.push({ exercise_id: s.exercise_id, nome: s.nome, series: [s] });
  }

  return (
    <Page>
      <PageHeader
        eyebrow={<BackLink to="/treino/progresso">Progresso</BackLink>}
        title={sessao?.nome || "Sessão"}
      >
        {sessao && (
          <p className="t-caption tabular-nums">
            {dataPorExtenso(sessao.data)}
            {sessao.series > 0 &&
              ` · ${sessao.series} ${sessao.series === 1 ? "série" : "séries"} · ${Math.round(sessao.volume_kg).toLocaleString("pt-BR")} kg`}
          </p>
        )}
      </PageHeader>

      {plano.length === 0 ? (
        sets.length === 0 ? (
          <Card>
            <EmptyState
              title="Sessão sem registro"
              description="Nenhuma série foi registrada nesta sessão."
            />
          </Card>
        ) : (
          <SemPlano sets={sets} exercicios={exercicios} />
        )
      ) : (
        blocos.map((b) => (
          <Card key={b.exercise_id} header={b.nome} padded={false}>
            <ul className="divide-y divide-border">
              {b.series.map((s) => (
                <LinhaComparada key={s.id} s={s} onEditar={() => setEditando(s)} />
              ))}
            </ul>
          </Card>
        ))
      )}

      <Button
        variant="ghost"
        block
        onClick={() => {
          if (sessionId === undefined) return;
          excluir.mutate(sessionId, { onSuccess: () => navigate("/treino/progresso") });
        }}
        className="text-destructive"
      >
        <Trash2 className="size-4" />
        Excluir esta sessão
      </Button>

      <SheetAjustarSerie
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        serie={editando}
        onRegistrar={(v) => {
          if (!editando) return;
          // Série já registrada: corrige a linha existente. Ainda não
          // registrada: cria a série que ficou faltando naquele dia.
          if (editando.set_id !== null) {
            atualizarSet.mutate({ id: editando.set_id, ...v });
          } else {
            registrar.mutate({ planId: editando.id, ...v });
          }
        }}
      />
    </Page>
  );
}
