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
  trocasDaRefeicao,
  trocasDoItem,
} from "@/domain/plano-dia";
import type { PlanBlock, PlanItem, PlanSwap, Troca } from "@/domain/plano-types";
import { ROTULO } from "./escolher-alimento";
import type { Aba, Escolha } from "./escolher-alimento";
import { TrocarItem } from "./trocar-item";
import { TrocarRefeicao } from "./trocar-refeicao";

/* ══════════════════════════════════════════════════════════════════
   NÍVEL 1 — a refeição
   ══════════════════════════════════════════════════════════════════ */

/**
 * A refeição de hoje, e os dois jeitos de mexer nela.
 *
 * Tocar numa linha troca só ela (nível 2). "Refeição inteira" a substitui por
 * uma lista nova (nível 3), de quantos alimentos você quiser e sem relação com
 * as linhas — o caminho de quem comeu uma pizza no lugar do almoço.
 *
 * Os dois não convivem no mesmo bloco no mesmo dia: com a refeição substituída
 * as linhas ficam riscadas em bloco e deixam de ser tocáveis, e a saída é
 * "Voltar ao plano". É o que impede um toque errado numa linha de custar a
 * lista inteira.
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
  onTrocarRefeicao,
  onDesfazerRefeicao,
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
  /** Acrescenta um alimento à lista que substitui a refeição inteira. */
  onTrocarRefeicao: (e: Escolha) => void;
  /** "Voltar ao plano": apaga os dois escopos do bloco. */
  onDesfazerRefeicao: () => void;
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
  /** O nível 3 está aberto? */
  const [refeicaoAberta, setRefeicaoAberta] = useState(false);

  const aberto = itens.find((i) => i.id === abertoId) ?? null;
  const daRefeicao = trocasDaRefeicao(trocas, bloco.id);
  const substituida = daRefeicao.length > 0;

  // O que o "Comi" não consegue lançar no diário, nos dois escopos. Dizer isso
  // é o que torna honesto não contar: o app não sabe aquela caloria, e o
  // silêncio pareceria zero.
  const resolvida = refeicaoResolvida(itens, trocas, bloco.id);
  const foraDoBalanco = new Set(resolvida.semAlimento.map((i) => i.id));
  const naoContadas = new Set(resolvida.naoContadas.map((t) => t.id));

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
        ) : refeicaoAberta ? (
          <TrocarRefeicao
            bloco={bloco}
            swaps={swaps}
            escolhidas={daRefeicao}
            aba={abaPreferida}
            onAba={setAbaPreferida}
            onEscolher={onTrocarRefeicao}
            onRemoverUma={onRemoverUma}
            onVoltar={() => setRefeicaoAberta(false)}
            onVoltarAoPlano={() => {
              onDesfazerRefeicao();
              setRefeicaoAberta(false);
            }}
          />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{bloco.nome}</SheetTitle>
              <SheetDescription>
                {substituida
                  ? "Você trocou a refeição inteira."
                  : "Toque numa linha para trocar só ela, ou troque a refeição inteira por uma lista nova."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4">
              {itens.length === 0 ? (
                <p className="t-caption py-6 text-center">
                  Esta refeição não tem itens no seu plano.
                </p>
              ) : substituida ? (
                <div className="space-y-3">
                  {/* O plano continua visível: a troca só faz sentido contra o
                      que ela substituiu, e sumi-lo apagaria o que o
                      nutricionista mandou. Riscado em BLOCO, porque foi a
                      refeição que saiu, não cada linha. */}
                  <div>
                    <p className="t-caption">o plano previa</p>
                    <ul className="mt-1 space-y-0.5">
                      {itens.map((item) => (
                        <li key={item.id} className="text-sm text-muted-foreground line-through">
                          {item.texto}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {daRefeicao.map((t) => (
                      <li key={t.id} className="flex items-center gap-1 pr-2">
                        <span className="min-w-0 flex-1 py-2.5 pl-4">
                          <span className="block truncate text-sm font-medium text-primary">
                            {descreverTroca(t)}
                          </span>
                          {naoContadas.has(t.id) && (
                            <span className="t-caption block">
                              não entra no balanço — escolha pelo catálogo
                            </span>
                          )}
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
                </div>
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

            <div className="space-y-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {itens.length > 0 && (
                <div className="flex gap-2">
                  {substituida ? (
                    <>
                      <Button variant="outline" className="flex-1" onClick={onDesfazerRefeicao}>
                        Voltar ao plano
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setRefeicaoAberta(true)}
                      >
                        Adicionar alimento
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Dois verbos, porque são duas perguntas diferentes:
                          "quero corrigir cada linha" e "comi outra coisa no
                          lugar dessa refeição". Um botão só, chamado "trocar
                          tudo", respondia a segunda com a primeira. */}
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setPercorrendo(0); setAbertoId(itens[0].id); }}
                      >
                        <Repeat className="size-4" />
                        Linha a linha
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setRefeicaoAberta(true)}
                      >
                        Refeição inteira
                      </Button>
                    </>
                  )}
                </div>
              )}
              <Button block onClick={() => { onMarcar(!feito); onClose(); }}>
                {feito ? "Desmarcar" : "Comi"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
