import { ChevronLeft, X } from "lucide-react";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { descreverTroca, kcalDaRefeicao, trocasDoBloco } from "@/domain/plano-dia";
import type { PlanBlock, PlanSwap, Troca } from "@/domain/plano-types";
import { EscolherAlimento } from "./escolher-alimento";
import type { Aba, Escolha } from "./escolher-alimento";

/* ══════════════════════════════════════════════════════════════════
   NÍVEL 3 — trocar a REFEIÇÃO inteira
   ══════════════════════════════════════════════════════════════════ */

/**
 * A refeição substituída por uma lista nova, de quantos alimentos você quiser.
 *
 * A diferença que justifica o nível: aqui TODO confirmar acrescenta, inclusive
 * na aba "Do plano". No nível da linha, escolher uma segunda opção prevista é
 * corrigir a primeira — duas substituições para a mesma linha não é o que
 * aquele toque quer dizer. No nível da refeição, escolher duas é exatamente o
 * que este quer.
 *
 * E a lista não tem o tamanho do que o nutricionista escreveu: percorrer as
 * linhas uma a uma prendia o que você comeu ao número de linhas do plano, e
 * quem trocou o almoço por uma pizza não tem quatro respostas para dar.
 */
export function TrocarRefeicao({
  bloco,
  swaps,
  escolhidas,
  aba,
  onAba,
  onEscolher,
  onRemoverUma,
  onVoltar,
  onVoltarAoPlano,
}: {
  bloco: PlanBlock;
  swaps: PlanSwap[];
  /** A lista que já substitui a refeição, na ordem em que foi montada. */
  escolhidas: Troca[];
  aba: Aba;
  onAba: (a: Aba) => void;
  onEscolher: (e: Escolha) => void;
  onRemoverUma: (trocaId: number) => void;
  onVoltar: () => void;
  onVoltarAoPlano: () => void;
}) {
  // Sem categoria de linha para filtrar, a lista é a do bloco inteiro, com
  // título por categoria.
  const grupos = [...trocasDoBloco(swaps, bloco.nome)].map(([categoria, opcoes]) => ({
    categoria,
    opcoes,
  }));

  // O `[]` de itens não é descuido: com a refeição substituída as linhas do
  // plano não entram na conta, e `kcalDaRefeicao` já sabe disso. A guarda do
  // `length` é o que impede a função de cair no ramo das linhas enquanto ainda
  // não há nada escolhido.
  const soma = escolhidas.length > 0 ? kcalDaRefeicao([], escolhidas, new Map(), bloco.id) : null;

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onVoltar}
            aria-label="Voltar para a refeição"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate">Trocar {bloco.nome}</SheetTitle>
            <SheetDescription>Monte o que você comeu</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {escolhidas.length > 0 && soma && (
          <div className="space-y-1">
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {escolhidas.map((t) => (
                <li key={t.id} className="flex items-center gap-1 pr-2">
                  <span className="min-w-0 flex-1 truncate py-2.5 pl-4 text-sm">
                    {descreverTroca(t)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoverUma(t.id)}
                    aria-label={`Remover ${t.nome}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            {/* O `+` é a mesma honestidade do card: sem a caloria de alguma
                escolha, o app não pode afirmar o total — e calar isso contaria
                zero, que é uma afirmação diferente de "não sei". */}
            <p className="t-caption tabular-nums">
              {soma.total}
              {soma.incompleto ? "+" : ""} kcal
              {bloco.kcal_alvo != null && ` · meta ~${bloco.kcal_alvo}`}
            </p>
          </div>
        )}

        <EscolherAlimento
          aba={aba}
          onAba={onAba}
          grupos={grupos}
          vazio="Seu plano não lista substituição para esta refeição. Use o catálogo ou escreva o que você comeu."
          acrescenta={escolhidas.length > 0}
          /* Nenhuma opção fica "pressionada": aqui a mesma pode entrar duas
             vezes, e marcá-la sugeriria que o segundo toque desfaz o primeiro. */
          swapAtivo={null}
          onConfirmar={onEscolher}
        />

        {escolhidas.length > 0 && (
          <div className="border-t border-border pt-3">
            <Button variant="outline" block onClick={onVoltarAoPlano}>
              Voltar ao plano
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
