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
            aria-pressed={value === p}
            onClick={() => onChange(p)}
            className={cn(
              "min-h-11 flex-1 rounded-md border px-3 text-sm font-medium transition-colors",
              value === p
                ? "border-primary bg-tint-primary text-primary"
                : "border-input text-muted-foreground hover:bg-muted",
            )}
          >
            {ROTULO[p]}
            {down && (
              <span className="ml-1.5 text-destructive" title="fora do ar">
                • fora do ar
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
