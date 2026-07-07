import { Droplets } from "lucide-react";
import { Button } from "./ui/button";
import { HudPanel } from "./ui/hud-panel";
import { useWaterToday, useAddWater, useResetWater } from "../hooks/use-water-today";

export const META_AGUA_ML = 3000;

export function WaterCounter({ data }: { data: string }) {
  const { data: total = 0 } = useWaterToday(data);
  const add = useAddWater(data);
  const reset = useResetWater(data);
  const pct = Math.min(100, (total / META_AGUA_ML) * 100);

  return (
    <HudPanel
      label={
        <span className="flex items-center gap-1.5">
          <Droplets className="size-3.5" style={{ color: "var(--chart-2)" }} />
          Hidratação
        </span>
      }
      aside={`${total} / ${META_AGUA_ML} ml`}
      bodyClassName="space-y-3"
    >
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: "var(--chart-2)", boxShadow: "0 0 10px -2px var(--chart-2)" }}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => add.mutate(250)}>
          + copo (250)
        </Button>
        <Button size="sm" variant="secondary" onClick={() => add.mutate(500)}>
          + garrafa (500)
        </Button>
        <Button size="sm" variant="ghost" onClick={() => reset.mutate()}>
          zerar
        </Button>
      </div>
    </HudPanel>
  );
}
