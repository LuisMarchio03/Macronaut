import { Card } from "@/components/ui/card";
import { BackLink, Page, PageHeader } from "@/components/ui/page";
import { ProgressaoTab } from "@/components/treino/progressao-tab";
import { useLevantamentos, useMarcasAmrap, useProgramaAtivo } from "@/hooks/use-programa";
import { e1RMDaSerie } from "@/domain/531";

/** Melhor marca de AMRAP de um levantamento, pelo 1RM estimado que ela dá. */
function RecordeDoLevantamento({
  nome,
  exerciseId,
}: {
  nome: string;
  exerciseId: number;
}) {
  const { data: marcas = [] } = useMarcasAmrap(exerciseId);
  if (marcas.length === 0) {
    return (
      <li className="flex items-baseline justify-between gap-3 px-4 py-2.5">
        <span className="min-w-0 truncate text-sm font-medium">{nome}</span>
        <span className="t-caption shrink-0">sem série até a falha ainda</span>
      </li>
    );
  }

  const melhor = marcas.reduce((a, b) =>
    e1RMDaSerie(b.peso_kg, b.reps) > e1RMDaSerie(a.peso_kg, a.reps) ? b : a,
  );

  return (
    <li className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{nome}</span>
        <span className="t-caption block tabular-nums">
          {melhor.reps} reps × {melhor.peso_kg} kg
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        1RM ≈ {e1RMDaSerie(melhor.peso_kg, melhor.reps)} kg
      </span>
    </li>
  );
}

export function TreinoProgressao() {
  const { data: programa } = useProgramaAtivo();
  const { data: lifts = [] } = useLevantamentos(programa);

  return (
    <Page>
      <PageHeader eyebrow={<BackLink to="/treino">Treino</BackLink>} title="Progressão" />

      {lifts.length > 0 && (
        <Card
          header="Melhores marcas"
          aside="da série até a falha"
          padded={false}
        >
          <ul className="divide-y divide-border">
            {lifts.map((l) => (
              <RecordeDoLevantamento key={l.id} nome={l.nome} exerciseId={l.exercise_id} />
            ))}
          </ul>
        </Card>
      )}

      <ProgressaoTab />
    </Page>
  );
}
