import { Droplets } from "lucide-react";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { useWaterToday, useAddWater, useResetWater } from "../hooks/use-water-today";

export const META_AGUA_ML = 3000;

/** Litros com uma casa e vírgula decimal: 1250 → "1,3 L". */
function litros(ml: number): string {
  return `${(ml / 1000).toFixed(1).replace(".", ",")} L`;
}

export function WaterCounter({ data, meta = META_AGUA_ML }: { data: string; meta?: number }) {
  const { data: total = 0 } = useWaterToday(data);
  const add = useAddWater(data);
  const reset = useResetWater(data);
  const cumprida = meta > 0 && total >= meta;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2">
          <Droplets className="size-4 shrink-0 text-macro-carb" aria-hidden />
          <span className="t-caption text-foreground">Hidratação</span>
        </span>
        {/* Litros em vez de "1250 / 3000 ml": ninguém pensa a própria
            hidratação do dia em mililitros. */}
        <span className="t-caption shrink-0 tabular-nums">
          <span className="font-medium text-foreground">{litros(total)}</span>
          {" / "}
          {litros(meta)}
        </span>
      </div>

      <Progress
        value={total}
        max={meta}
        tone={cumprida ? "success" : "carb"}
        size="sm"
        className="mt-2.5"
        label={`Água: ${total} de ${meta} mililitros`}
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => add.mutate(250)}
          className="h-10 flex-1 rounded-md border border-input text-sm font-medium transition-colors hover:bg-muted active:bg-muted"
        >
          + copo
        </button>
        <button
          type="button"
          onClick={() => add.mutate(500)}
          className="h-10 flex-1 rounded-md border border-input text-sm font-medium transition-colors hover:bg-muted active:bg-muted"
        >
          + garrafa
        </button>
        <button
          type="button"
          onClick={() => reset.mutate()}
          className="h-10 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
        >
          Zerar
        </button>
      </div>
    </Card>
  );
}
