import { cn } from "../../lib/utils";
import type { HealthRes } from "../../lib/ai-gateway";

type Provider = "gemini" | "aloy";
const ROTULO: Record<Provider, string> = { gemini: "Gemini", aloy: "ALOY" };

export function ProviderSelector({
  enabled, value, onChange, health,
}: {
  enabled: { gemini: boolean; aloy: boolean };
  value: Provider;
  onChange: (p: Provider) => void;
  health: HealthRes | undefined;
}) {
  const provedores = (["gemini", "aloy"] as Provider[]).filter((p) => enabled[p]);
  return (
    <div className="flex gap-2" role="group" aria-label="Provedor de IA">
      {provedores.map((p) => {
        const down = health ? !health[p].up : false;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] transition-colors",
              value === p ? "border-primary/70 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground",
            )}
          >
            {ROTULO[p]}
            {down && <span className="ml-1 text-destructive">•</span>}
          </button>
        );
      })}
    </div>
  );
}
