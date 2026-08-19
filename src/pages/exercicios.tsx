import { ExerciciosTab } from "@/components/treino/exercicios-tab";

/**
 * O painel "Exercícios": a biblioteca que abastece o autocomplete, a rotina e
 * a análise.
 *
 * Morava em "Mais" — três toques de distância de onde ela é usada, e no menu
 * de configurações do app, como se escolher exercício fosse configuração.
 */
export function Exercicios() {
  return (
    <>
      <p className="t-caption">
        O catálogo que abastece o autocomplete e a rotina. Os do catálogo não podem ser
        editados; os seus, sim.
      </p>
      <ExerciciosTab />
    </>
  );
}
