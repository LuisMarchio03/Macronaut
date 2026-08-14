import { cn } from "../../lib/utils";
import type { HealthRes } from "../../lib/ai-gateway";

function Badge({ nome, id, up }: { nome: string; id: string; up: boolean }) {
  return (
    <span
      data-testid={`status-${id}`}
      data-up={up}
      className="t-caption flex items-center gap-1.5"
    >
      <span aria-hidden className={cn("size-2 rounded-full", up ? "bg-success" : "bg-destructive")} />
      {/* O texto diz o estado; a bolinha sozinha seria informação só na cor. */}
      {nome} {up ? "no ar" : "fora do ar"}
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
