import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const PADRAO_S = 150;

function mmss(s: number): string {
  const m = Math.floor(Math.abs(s) / 60);
  const seg = Math.abs(s) % 60;
  return `${s < 0 ? "+" : ""}${m}:${String(seg).padStart(2, "0")}`;
}

/**
 * Descanso entre séries.
 *
 * Conta para baixo e **continua contando depois do zero**, em vez de parar:
 * saber que já se passaram 4:30 quando o alvo era 2:30 é informação; um
 * "00:00" congelado não é. Sem notificação — o app não roda em segundo plano,
 * e prometer um alarme que não toca seria pior do que não prometer.
 */
export function CronometroDescanso({
  chave,
  segundos = PADRAO_S,
}: {
  /** Muda a cada série registrada; reinicia a contagem. */
  chave: number;
  segundos?: number;
}) {
  const [restante, setRestante] = useState(segundos);
  const [rodando, setRodando] = useState(false);
  const primeira = useRef(true);

  useEffect(() => {
    // Não começa sozinho ao abrir a tela: só depois da primeira série.
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    setRestante(segundos);
    setRodando(true);
  }, [chave, segundos]);

  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => setRestante((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [rodando]);

  const estourou = restante < 0;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2">
      <span className="t-caption shrink-0">Descanso</span>
      <span
        aria-live="off"
        className={cn(
          "min-w-[3.5rem] text-lg font-bold tabular-nums",
          estourou && "text-warning",
        )}
      >
        {mmss(restante)}
      </span>
      <div className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={() => setRodando((v) => !v)}
          aria-label={rodando ? "Pausar descanso" : "Iniciar descanso"}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          {rodando ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setRestante(segundos);
            setRodando(true);
          }}
          aria-label="Reiniciar descanso"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>
    </div>
  );
}
