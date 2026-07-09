import { cn } from "../../lib/utils";
import type { HealthRes } from "../../lib/ai-gateway";

function Badge({ nome, id, up }: { nome: string; id: string; up: boolean }) {
  return (
    <span
      data-testid={`status-${id}`}
      data-up={up}
      className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
    >
      <span className={cn("size-2 rounded-full", up ? "bg-emerald-400" : "bg-destructive")} />
      {nome}
    </span>
  );
}

export function AiStatusBadges({
  health,
  enabled,
}: {
  health: HealthRes | undefined;
  enabled: { gemini: boolean; aloy: boolean };
}) {
  return (
    <div className="flex gap-4">
      {enabled.gemini && <Badge nome="Gemini" id="gemini" up={!!health?.gemini.up} />}
      {enabled.aloy && <Badge nome="ALOY" id="aloy" up={!!health?.aloy.up} />}
    </div>
  );
}
