import { useState } from "react";
import { CircleAlert, X, ChevronDown } from "lucide-react";
import { useFalhas, descartarFalha, type FalhaVisivel } from "@/lib/falhas";

function Aviso({ falha }: { falha: FalhaVisivel }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div
      role="alert"
      className="pointer-events-auto rounded-xl border border-destructive/40 bg-popover p-3 shadow-[var(--shadow-3)]"
    >
      <div className="flex gap-2.5">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{falha.titulo}</p>
          {falha.acao && <p className="t-caption mt-0.5">{falha.acao}</p>}

          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="t-caption mt-1.5 inline-flex min-h-8 items-center gap-1 font-medium text-primary"
          >
            <ChevronDown
              className={aberto ? "size-3.5 rotate-180 transition-transform" : "size-3.5 transition-transform"}
              aria-hidden
            />
            Detalhe técnico
          </button>
          {aberto && (
            <p className="mt-1 rounded-md bg-muted px-2 py-1.5 font-mono text-[0.75rem] break-words">
              {falha.original}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => descartarFalha(falha.id)}
          aria-label="Dispensar aviso"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Mostra as falhas que o app não conseguiu resolver sozinho.
 *
 * Antes disso, o `MutationCache` capturava o erro, ninguém lia, e a operação
 * falhava em silêncio — o botão voltava ao normal e nada acontecia. É o que
 * fazia "importar não funciona" ser indistinguível de "cliquei errado".
 */
export function AvisosDeFalha() {
  const falhas = useFalhas();
  if (falhas.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto max-w-lg space-y-2 p-3">
      {falhas.map((f) => (
        <Aviso key={f.id} falha={f} />
      ))}
    </div>
  );
}
