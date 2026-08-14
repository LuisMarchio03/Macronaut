import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { trocasDoBloco } from "@/domain/plano-dia";
import type { PlanSwap } from "@/domain/plano-types";

const ROTULO: Record<string, string> = {
  proteina: "Proteína",
  carboidrato: "Carboidrato",
  fruta: "Fruta",
  gordura: "Gordura",
  vegetal: "Vegetal",
  outros: "Outros",
};

/**
 * As trocas previstas no plano para uma refeição, agrupadas por categoria.
 *
 * Só aparecem as opções que o próprio plano lista — o app não inventa
 * substituição, porque quem escreveu a dieta é quem decide o que equivale
 * a o quê.
 */
export function SheetTrocas({
  blockNome,
  swaps,
  onEscolher,
  onClose,
}: {
  blockNome: string;
  swaps: PlanSwap[];
  onEscolher: (swap: PlanSwap) => void;
  onClose: () => void;
}) {
  const grupos = trocasDoBloco(swaps, blockNome);

  return (
    <Sheet open onOpenChange={(aberto) => !aberto && onClose()}>
      {/* Sai de baixo, não da lateral: o polegar alcança, e a lista de trocas
          é longa o suficiente para precisar da altura inteira da tela. */}
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Trocar em {blockNome}</SheetTitle>
          <SheetDescription>
            Opções previstas no seu plano. Escolher uma marca a refeição como feita.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {[...grupos.entries()].map(([categoria, opcoes]) => (
            <section key={categoria}>
              <h3 className="t-section mb-2">{ROTULO[categoria] ?? categoria}</h3>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {opcoes.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onEscolher(s)}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.alimento}</span>
                        {s.porcao && <span className="t-caption block truncate">{s.porcao}</span>}
                      </span>
                      <span className="t-caption shrink-0 tabular-nums">{s.kcal} kcal</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {grupos.size === 0 && (
            <p className="t-caption py-6 text-center">
              Seu plano não lista substituições para esta refeição.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
