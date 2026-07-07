import type { Macros } from "../domain/types";

function Barra({
  nome,
  feito,
  meta,
  cor,
}: {
  nome: string;
  feito: number;
  meta: number;
  cor: string;
}) {
  const pct = meta > 0 ? Math.min(100, (feito / meta) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: cor, boxShadow: `0 0 8px -1px ${cor}` }} />
          {nome}
        </span>
        <span className="font-mono text-[0.72rem] tabular-nums text-foreground/90">
          {Math.round(feito)} / {Math.round(meta)} g
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: cor, boxShadow: `0 0 10px -2px ${cor}` }}
        />
      </div>
    </div>
  );
}

export function MacroBars({ consumido, meta }: { consumido: Macros; meta: Macros }) {
  return (
    <div className="space-y-3.5">
      <Barra nome="Proteína" feito={consumido.prot_g} meta={meta.prot_g} cor="var(--chart-1)" />
      <Barra nome="Carboidrato" feito={consumido.carb_g} meta={meta.carb_g} cor="var(--chart-2)" />
      <Barra nome="Gordura" feito={consumido.gord_g} meta={meta.gord_g} cor="var(--chart-3)" />
    </div>
  );
}
