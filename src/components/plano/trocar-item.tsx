import { useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { descreverTroca, trocasDoBloco, trocasPara } from "@/domain/plano-dia";
import type { PlanBlock, PlanItem, PlanSwap, Troca } from "@/domain/plano-types";
import { EscolherAlimento, ROTULO } from "./escolher-alimento";
import type { Aba, Escolha } from "./escolher-alimento";

/* ══════════════════════════════════════════════════════════════════
   NÍVEL 2 — trocar UMA linha
   ══════════════════════════════════════════════════════════════════ */

/**
 * O que você comeu no lugar de UMA linha do plano.
 *
 * O escopo é a linha: o que entra aqui fica pendurado nela, e a refeição
 * continua sendo o que o nutricionista escreveu, com esta linha corrigida.
 * Trocar a refeição inteira é outro nível — ver `TrocarRefeicao`.
 */
export function TrocarItem({
  item,
  bloco,
  swaps,
  trocaAtual,
  onEscolher,
  onVoltar,
  passo,
  abaInicial,
  onAba,
  escolhidas,
  dispensado,
  onRemoverUma,
  onDispensar,
  onVoltarAoPlano,
  onProximo,
}: {
  item: PlanItem;
  bloco: PlanBlock;
  swaps: PlanSwap[];
  trocaAtual: Troca | null;
  onEscolher: (e: Escolha) => void;
  onVoltar: () => void;
  /** "2 de 5" quando se está percorrendo a refeição inteira. */
  passo: { i: number; total: number } | null;
  /** Onde abrir. A folha lembra a última escolhida ao percorrer a refeição. */
  abaInicial: Aba;
  onAba: (a: Aba) => void;
  /** O que já foi escolhido para ESTA linha. */
  escolhidas: Troca[];
  dispensado: boolean;
  onRemoverUma: (trocaId: number) => void;
  onDispensar: () => void;
  onVoltarAoPlano: () => void;
  onProximo: () => void;
}) {
  const [aba, setAba] = useState<Aba>(abaInicial);

  // As opções que o plano prevê para ESTA linha. Item sem categoria não tem
  // uma resposta certa, então recebe tudo o que o bloco autoriza — melhor
  // escolher entre demais do que não ter caminho nenhum.
  const doPlano = item.categoria
    ? trocasPara(swaps, bloco.nome, item.categoria)
    : [...trocasDoBloco(swaps, bloco.nome).values()].flat();

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
            <SheetTitle className="truncate">Trocar “{item.texto}”</SheetTitle>
            <SheetDescription>
              {passo
                ? `Item ${passo.i} de ${passo.total} · ${bloco.nome}`
                : (ROTULO[item.categoria ?? ""] ?? bloco.nome)}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {escolhidas.length > 0 && (
          /* A lista é o que substitui a rede que o `UNIQUE` dava: sem ele, dois
             toques rápidos gravam duas linhas iguais — e aqui isso fica
             visível, e desfazível num toque. */
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
        )}

        <EscolherAlimento
          aba={aba}
          onAba={(a) => {
            setAba(a);
            onAba(a);
          }}
          /* Um grupo só, sem título: as opções já vêm filtradas pela categoria
             da linha, e um cabeçalho repetiria o que o subtítulo já diz. */
          grupos={[{ categoria: null, opcoes: doPlano }]}
          vazio="Seu plano não lista substituição para esta linha. Use o catálogo ou escreva o que você comeu."
          acrescenta={escolhidas.length > 0}
          swapAtivo={trocaAtual?.swap_id ?? null}
          onConfirmar={onEscolher}
        />

        {/* A terceira resposta possível sobre uma linha, e a única que não é
            "comi outra coisa". */}
        <div className="space-y-1 border-t border-border pt-3">
          {dispensado ? (
            <Button variant="outline" block onClick={onVoltarAoPlano}>
              Voltar ao plano
            </Button>
          ) : (
            <button
              type="button"
              onClick={onDispensar}
              className="flex min-h-11 w-full items-center justify-center text-[0.8125rem] font-medium text-muted-foreground"
            >
              Não comi esta linha
            </button>
          )}
          {passo && passo.i < passo.total && (
            <Button variant="outline" block onClick={onProximo}>
              Próximo item
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
