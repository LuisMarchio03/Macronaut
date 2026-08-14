import { Progress, type ProgressTone } from "@/components/ui/progress";
import type { Macros } from "../domain/types";

function Barra({
  nome,
  feito,
  meta,
  tone,
}: {
  nome: string;
  feito: number;
  meta: number;
  tone: ProgressTone;
}) {
  const restante = Math.round(meta - feito);
  const estourou = restante < 0;

  return (
    <div className="space-y-1.5">
      {/* `min-w-0` + `gap` no lugar de `justify-between` puro: sem eles o nome
          longo empurrava o valor e "Carboidrato" colava em "47 / 160 g". */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: `var(--macro-${tone})` }}
          />
          <span className="t-caption truncate text-foreground">{nome}</span>
        </span>
        <span className="t-caption shrink-0 tabular-nums">
          <span className="font-medium text-foreground">{Math.round(feito)}</span>
          {" / "}
          {Math.round(meta)} g
        </span>
      </div>

      <Progress
        value={feito}
        max={meta}
        tone={tone}
        overflowTone="warning"
        size="sm"
        label={`${nome}: ${Math.round(feito)} de ${Math.round(meta)} gramas`}
      />

      {estourou && (
        <p className="text-[0.75rem] text-warning tabular-nums">
          {-restante} g acima da meta
        </p>
      )}
    </div>
  );
}

export function MacroBars({ consumido, meta }: { consumido: Macros; meta: Macros }) {
  return (
    <div className="space-y-3">
      <Barra nome="Proteína" feito={consumido.prot_g} meta={meta.prot_g} tone="prot" />
      <Barra nome="Carboidrato" feito={consumido.carb_g} meta={meta.carb_g} tone="carb" />
      <Barra nome="Gordura" feito={consumido.gord_g} meta={meta.gord_g} tone="gord" />
    </div>
  );
}
