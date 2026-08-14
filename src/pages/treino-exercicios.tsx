import { BackLink, Page, PageHeader } from "@/components/ui/page";
import { ExerciciosTab } from "@/components/treino/exercicios-tab";

export function TreinoExercicios() {
  return (
    <Page>
      <PageHeader
        eyebrow={<BackLink to="/treino">Treino</BackLink>}
        title="Exercícios"
      >
        <p className="t-caption">
          O catálogo que abastece o autocomplete e o programa. Os do catálogo não podem ser
          editados; os seus, sim.
        </p>
      </PageHeader>
      <ExerciciosTab />
    </Page>
  );
}
