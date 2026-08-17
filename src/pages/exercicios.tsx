import { BackLink, Page, PageHeader } from "@/components/ui/page";
import { ExerciciosTab } from "@/components/treino/exercicios-tab";

export function Exercicios() {
  return (
    <Page>
      <PageHeader
        eyebrow={<BackLink to="/mais">Mais</BackLink>}
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
