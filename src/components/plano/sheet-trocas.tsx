import { useState } from "react";
import { ChevronRight, Repeat, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  descreverTroca,
  itemDispensado,
  refeicaoResolvida,
  trocasDoItem,
} from "@/domain/plano-dia";
import type { PlanBlock, PlanItem, PlanSwap, Troca } from "@/domain/plano-types";
import { ROTULO } from "./escolher-alimento";
import type { Aba, Escolha } from "./escolher-alimento";
import { TrocarItem } from "./trocar-item";

/* ══════════════════════════════════════════════════════════════════
   NÍVEL 1 — a refeição
   ══════════════════════════════════════════════════════════════════ */

/**
 * A refeição de hoje, linha a linha, com a troca de cada uma.
 *
 * Era uma lista chapada de todas as substituições do bloco, e escolher uma
 * marcava a refeição inteira — o que tornava impossível trocar a segunda
 * linha. A refeição é a unidade que se vê; o ITEM é a unidade que se troca.
 */
export function SheetTrocas({
  bloco,
  itens,
  swaps,
  trocas,
  feito,
  onTrocar,
  onAdicionar,
  onRemoverUma,
  onDispensar,
  onDesfazer,
  onMarcar,
  onClose,
}: {
  bloco: PlanBlock;
  itens: PlanItem[];
  swaps: PlanSwap[];
  trocas: Troca[];
  feito: boolean;
  /** Substitui tudo na linha — o que a aba "Do plano" faz. */
  onTrocar: (itemId: number, e: Escolha) => void;
  /** Acrescenta sem tirar os que já estavam — catálogo e texto livre. */
  onAdicionar: (itemId: number, e: Escolha) => void;
  onRemoverUma: (trocaId: number) => void;
  onDispensar: (itemId: number) => void;
  /** Devolve a linha ao plano: apaga trocas e dispensa. */
  onDesfazer: (itemId: number) => void;
  onMarcar: (feito: boolean) => void;
  onClose: () => void;
}) {
  /** Item aberto no nível 2. `null` = está vendo a refeição. */
  const [abertoId, setAbertoId] = useState<number | null>(null);
  /** Percorrendo a refeição inteira: o índice do item da vez. */
  const [percorrendo, setPercorrendo] = useState<number | null>(null);
  /**
   * De onde a última troca veio.
   *
   * O `key` de `TrocarItem` remonta o componente a cada item — que é o que
   * impede o alimento de uma linha de vazar para a seguinte —, e isso levaria
   * a aba junto. Quem troca a refeição inteira pelo catálogo teria que
   * escolher "Catálogo" em cada linha. O CAMINHO é uma preferência da pessoa;
   * o alimento é dado do item.
   */
  const [abaPreferida, setAbaPreferida] = useState<Aba>("plano");

  const aberto = itens.find((i) => i.id === abertoId) ?? null;

  // Quais linhas o "Comi" não consegue lançar no diário. Dizer isso é o que
  // torna honesto não contá-las: o app não sabe a caloria daquele item, e
  // silêncio pareceria zero.
  const foraDoBalanco = new Set(refeicaoResolvida(itens, trocas, bloco.id).semAlimento.map((i) => i.id));

  /**
   * Confirmar NÃO avança mais sozinho.
   *
   * Avançar era certo quando a linha comportava uma resposta só; com N
   * alimentos por linha, ele impediria a segunda escolha. Quem terminou a
   * linha toca em "Próximo item".
   *
   * "Do plano" substitui, catálogo e texto acrescentam: escolher duas
   * substituições previstas para a mesma linha não é o que aquele toque quer
   * dizer, e escolher dois alimentos do catálogo é exatamente o que este quer.
   */
  function escolher(itemId: number, e: Escolha) {
    if (e.swap_id != null) onTrocar(itemId, e);
    else onAdicionar(itemId, e);
  }

  /** No modo "trocar tudo", "Próximo item" leva à linha seguinte. */
  function avancar() {
    if (percorrendo === null) { setAbertoId(null); return; }
    const proximo = percorrendo + 1;
    if (proximo >= itens.length) { setPercorrendo(null); setAbertoId(null); return; }
    setPercorrendo(proximo);
    setAbertoId(itens[proximo].id);
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      {/* Sai de baixo, não da lateral: o polegar alcança, e a refeição com as
          opções de cada linha precisa da altura inteira da tela. */}
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl">
        {aberto ? (
          <TrocarItem
            /* A `key` é o conserto de um bug, não um detalhe do React: sem
               ela o componente é REUSADO ao avançar de item, e o alimento
               escolhido para a linha anterior continua carregado — com o
               botão "Trocar por X" pronto. Quem percorria a refeição tocava
               nele e acabava com o mesmo alimento em todas as linhas. */
            key={aberto.id}
            item={aberto}
            bloco={bloco}
            swaps={swaps}
            trocaAtual={trocasDoItem(trocas, aberto.id)[0] ?? null}
            /* A troca que já existe manda: reabrir uma linha leva de volta a
               onde ela foi feita, não à última aba usada noutra linha. */
            abaInicial={trocasDoItem(trocas, aberto.id)[0]?.origem ?? abaPreferida}
            onAba={setAbaPreferida}
            passo={percorrendo !== null ? { i: percorrendo + 1, total: itens.length } : null}
            onEscolher={(e) => escolher(aberto.id, e)}
            onVoltar={() => { setPercorrendo(null); setAbertoId(null); }}
            escolhidas={trocasDoItem(trocas, aberto.id)}
            dispensado={itemDispensado(trocas, aberto.id)}
            onRemoverUma={onRemoverUma}
            onDispensar={() => onDispensar(aberto.id)}
            onVoltarAoPlano={() => onDesfazer(aberto.id)}
            onProximo={avancar}
          />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{bloco.nome}</SheetTitle>
              <SheetDescription>
                Toque numa linha para trocar. Trocar todas é trocar a refeição inteira.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4">
              {itens.length === 0 ? (
                <p className="t-caption py-6 text-center">
                  Esta refeição não tem itens no seu plano.
                </p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {itens.map((item) => {
                    const doItem = trocasDoItem(trocas, item.id);
                    const dispensado = itemDispensado(trocas, item.id);
                    const mexida = doItem.length > 0 || dispensado;
                    return (
                      <li key={item.id}>
                        <div className="flex items-center gap-1 pr-2">
                          <button
                            type="button"
                            onClick={() => setAbertoId(item.id)}
                            aria-label={`Trocar ${item.texto}`}
                            className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors hover:bg-muted"
                          >
                            <span className="min-w-0 flex-1">
                              {item.categoria && (
                                <span className="t-caption block">{ROTULO[item.categoria] ?? item.categoria}</span>
                              )}
                              <span
                                className={
                                  mexida
                                    ? "block text-sm text-muted-foreground line-through"
                                    : "block text-sm"
                                }
                              >
                                {item.texto}
                              </span>
                              {/* Empilhadas, uma por alimento escolhido: a
                                  linha do plano vira a lista do que você de
                                  fato comeu no lugar dela. */}
                              {doItem.map((t) => (
                                <span key={t.id} className="mt-0.5 block text-sm font-medium text-primary">
                                  {descreverTroca(t)}
                                </span>
                              ))}
                              {dispensado && (
                                <span className="t-caption mt-0.5 block">dispensado</span>
                              )}
                              {foraDoBalanco.has(item.id) && (
                                <span className="t-caption mt-0.5 block">
                                  não entra no balanço — escolha pelo catálogo
                                </span>
                              )}
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          </button>
                          {mexida && (
                            <button
                              type="button"
                              onClick={() => onDesfazer(item.id)}
                              aria-label={`Devolver ${item.texto} ao plano`}
                              className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                            >
                              <X className="size-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex gap-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {itens.length > 0 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setPercorrendo(0); setAbertoId(itens[0].id); }}
                >
                  <Repeat className="size-4" />
                  Trocar tudo
                </Button>
              )}
              <Button className="flex-1" onClick={() => { onMarcar(!feito); onClose(); }}>
                {feito ? "Desmarcar" : "Comi"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
