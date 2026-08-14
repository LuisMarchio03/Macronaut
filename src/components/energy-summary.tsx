import { Progress } from "@/components/ui/progress";
import { MacroBars } from "@/components/macro-bars";
import type { Macros } from "../domain/types";

/**
 * A leitura principal do dia: quanto já foi consumido, quanto falta, e como os
 * macros estão distribuídos.
 *
 * Um número só, grande. A versão anterior mostrava as mesmas calorias no anel,
 * de novo num card logo abaixo e mais uma vez no texto de porcentagem — três
 * leituras do mesmo dado competindo pela atenção.
 */
export function EnergySummary({
  consumido,
  meta,
  faixa,
}: {
  consumido: Macros;
  meta: Macros;
  /** Faixa do plano, quando houver: "1700–2000 kcal" em vez de um alvo único. */
  faixa?: { min: number; max: number } | null;
}) {
  const kcal = Math.round(consumido.kcal);
  const alvo = Math.round(meta.kcal);
  const restante = alvo - kcal;
  const dentroDaFaixa = faixa ? kcal >= faixa.min && kcal <= faixa.max : false;
  const acimaDaFaixa = faixa ? kcal > faixa.max : restante < 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="t-display">{kcal.toLocaleString("pt-BR")}</span>
          <span className="t-caption font-medium">
            de {alvo.toLocaleString("pt-BR")} kcal
          </span>
        </div>

        <Progress
          value={consumido.kcal}
          max={meta.kcal}
          tone="primary"
          overflowTone="warning"
          size="lg"
          className="mt-3"
          label={`${kcal} de ${alvo} calorias`}
        />

        <p className="t-caption mt-2 tabular-nums">
          {acimaDaFaixa ? (
            <span className="text-warning">
              {Math.abs(faixa ? kcal - faixa.max : restante)} kcal acima
            </span>
          ) : dentroDaFaixa ? (
            <span className="text-success">Dentro da faixa do plano</span>
          ) : (
            <>Restam {restante.toLocaleString("pt-BR")} kcal</>
          )}
          {faixa && !dentroDaFaixa && !acimaDaFaixa && (
            <span className="opacity-70">
              {" · "}faixa {faixa.min}–{faixa.max}
            </span>
          )}
        </p>
      </div>

      <MacroBars consumido={consumido} meta={meta} />
    </div>
  );
}
