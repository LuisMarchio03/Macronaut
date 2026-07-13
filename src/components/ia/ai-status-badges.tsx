import { cn } from "../../lib/utils";
import type { HealthRes } from "../../lib/ai-gateway";

type Estado = "up" | "down" | "desconhecido";

const COR: Record<Estado, string> = {
  up: "bg-emerald-400",
  down: "bg-destructive",
  desconhecido: "bg-muted-foreground/40",
};

function Badge({
  nome,
  id,
  estado,
  detalhe,
}: {
  nome: string;
  id: string;
  estado: Estado;
  detalhe?: string;
}) {
  return (
    <span
      data-testid={`status-${id}`}
      data-up={estado === "up"}
      data-state={estado}
      title={detalhe}
      className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
    >
      <span className={cn("size-2 rounded-full", COR[estado])} />
      {nome}
    </span>
  );
}

export function AiStatusBadges({
  health,
  enabled,
  gatewayOffline = false,
}: {
  health: HealthRes | undefined;
  enabled: { gemini: boolean; aloy: boolean };
  gatewayOffline?: boolean;
}) {
  // Sem resposta do gateway não sabemos nada sobre os provedores. Marcá-los como
  // "offline" aponta o dedo pro Gemini/ALOY quando o problema é a ponte até eles.
  if (gatewayOffline) {
    return (
      <div className="flex gap-4">
        <span
          data-testid="status-gateway"
          data-up="false"
          className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-destructive"
        >
          <span className="size-2 rounded-full bg-destructive" />
          Gateway inalcançável
        </span>
      </div>
    );
  }

  const estado = (up: boolean | undefined): Estado =>
    health === undefined ? "desconhecido" : up ? "up" : "down";

  return (
    <div className="flex gap-4">
      {enabled.gemini && <Badge nome="Gemini" id="gemini" estado={estado(health?.gemini.up)} />}
      {enabled.aloy && (
        <Badge nome="ALOY" id="aloy" estado={estado(health?.aloy.up)} detalhe={health?.aloy.detail} />
      )}
    </div>
  );
}
