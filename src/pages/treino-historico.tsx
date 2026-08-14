import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BackLink, Page, PageHeader } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { useListSessions, useDeleteSession, useSessionSets } from "@/hooks/use-workouts";
import { useExercises } from "@/hooks/use-exercises";
import { dataPorExtenso } from "@/lib/date";
import { resumirSets, seriesEfetivas } from "@/domain/treino";

/** Uma sessão passada, com o resumo por exercício. */
function Sessao({
  id,
  data,
  nome,
  onExcluir,
}: {
  id: number;
  data: string;
  nome: string | null;
  onExcluir: () => void;
}) {
  const { data: sets = [] } = useSessionSets(id);
  const { data: exercicios = [] } = useExercises();
  const nomeEx = (exId: number) => exercicios.find((e) => e.id === exId)?.nome ?? "?";

  const porExercicio = [...new Set(sets.map((s) => s.exercise_id))];
  const efetivas = seriesEfetivas(sets);
  const volume = efetivas.reduce((soma, s) => soma + s.peso_kg * s.reps, 0);

  return (
    <Card padded={false}>
      <div className="flex items-start gap-2 px-4 pt-3 pb-1">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.9375rem] font-semibold">{nome || "Sessão"}</h3>
          <p className="t-caption tabular-nums">
            {dataPorExtenso(data)}
            {efetivas.length > 0 && (
              <>
                {" · "}
                {efetivas.length} séries · {Math.round(volume).toLocaleString("pt-BR")} kg de volume
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onExcluir}
          aria-label={`Excluir sessão de ${dataPorExtenso(data)}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      </div>

      {porExercicio.length > 0 && (
        <ul className="mt-1 divide-y divide-border border-t border-border">
          {porExercicio.map((exId) => {
            const doExercicio = seriesEfetivas(sets.filter((s) => s.exercise_id === exId));
            if (doExercicio.length === 0) return null;
            return (
              <li key={exId} className="flex items-baseline justify-between gap-3 px-4 py-2">
                <span className="min-w-0 truncate text-sm">{nomeEx(exId)}</span>
                <span className="t-caption shrink-0 tabular-nums">
                  {resumirSets(doExercicio)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function TreinoHistorico() {
  const { data: sessoes = [], isLoading } = useListSessions();
  const excluir = useDeleteSession();

  if (isLoading) {
    return (
      <Page>
        <SkeletonList rows={4} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow={<BackLink to="/treino">Treino</BackLink>}
        title="Histórico"
        action={
          sessoes.length > 0 && (
            <span className="t-caption tabular-nums">{sessoes.length} sessões</span>
          )
        }
      />

      {sessoes.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma sessão registrada"
            description="As sessões que você concluir aparecem aqui, com as séries e o volume de cada uma."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {sessoes.map((s) => (
            <Sessao
              key={s.id}
              id={s.id}
              data={s.data}
              nome={s.nome}
              onExcluir={() => excluir.mutate(s.id)}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
