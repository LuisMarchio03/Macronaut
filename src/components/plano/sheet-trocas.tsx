import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Repeat, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { useFoods, useFoodsByIds } from "@/hooks/use-foods";
import { useMeasures } from "@/hooks/use-food-measures";
import {
  descreverTroca,
  itemDispensado,
  itensResolvidos,
  trocasDoItem,
  trocasDoBloco,
  trocasPara,
} from "@/domain/plano-dia";
import { macrosDoEntry } from "@/domain/nutrition";
import { sugerirPorcao } from "@/domain/medida-default";
import { formatarNumero, resolverQtdBase } from "@/domain/medidas";
import type { PlanBlock, PlanItem, PlanSwap, TrocaDeItem } from "@/domain/plano-types";
import type { Food } from "@/domain/types";
import type { TrocaEntrada } from "@/repositories/plano";

const ROTULO: Record<string, string> = {
  proteina: "Proteína",
  carboidrato: "Carboidrato",
  fruta: "Fruta",
  gordura: "Gordura",
  vegetal: "Vegetal",
  outros: "Outros",
};

const BASE = "__base__"; // o <option> "na unidade base", como no diário

type Aba = "plano" | "catalogo" | "texto";

const ABAS = [
  { valor: "plano" as const, label: "Do plano" },
  { valor: "catalogo" as const, label: "Catálogo" },
  { valor: "texto" as const, label: "Escrever" },
];

/* ══════════════════════════════════════════════════════════════════
   NÍVEL 2 — trocar UM item
   ══════════════════════════════════════════════════════════════════ */

/**
 * As três origens de uma troca, numa folha só.
 *
 * "Do plano" é o caminho curto e o que o nutricionista autorizou, então abre
 * primeiro. Os outros dois existem porque a vida acontece: sem eles, o dia em
 * que você come outra coisa é um dia que o app perde inteiro.
 */
function TrocarItem({
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
  trocaAtual: TrocaDeItem | null;
  onEscolher: (e: Omit<TrocaEntrada, "data" | "block_id" | "item_id">) => void;
  onVoltar: () => void;
  /** "2 de 5" quando se está percorrendo a refeição inteira. */
  passo: { i: number; total: number } | null;
  /** Onde abrir. A folha lembra a última escolhida ao percorrer a refeição. */
  abaInicial: Aba;
  onAba: (a: Aba) => void;
  /** O que já foi escolhido para ESTA linha. */
  escolhidas: TrocaDeItem[];
  dispensado: boolean;
  onRemoverUma: (trocaId: number) => void;
  onDispensar: () => void;
  onVoltarAoPlano: () => void;
  onProximo: () => void;
}) {
  /** A troca de catálogo que já existe nesta linha, se houver. */
  const jaDoCatalogo = trocaAtual?.origem === "catalogo" ? trocaAtual : null;

  const [aba, setAba] = useState<Aba>(abaInicial);
  const [termo, setTermo] = useState(jaDoCatalogo?.nome ?? "");
  const [alimento, setAlimento] = useState<Food | null>(null);
  const [qtd, setQtd] = useState(
    jaDoCatalogo ? formatarNumero(jaDoCatalogo.medidas ?? jaDoCatalogo.qty_g ?? 0) : "",
  );
  const [medidaId, setMedidaId] = useState<string>(
    jaDoCatalogo?.measure_id != null ? String(jaDoCatalogo.measure_id) : BASE,
  );
  const [texto, setTexto] = useState(trocaAtual?.origem === "texto" ? trocaAtual.nome : "");
  const [kcalTexto, setKcalTexto] = useState(
    trocaAtual?.origem === "texto" && trocaAtual.kcal !== null ? String(trocaAtual.kcal) : "",
  );

  const { data: resultados = [] } = useFoods(termo);

  /**
   * Reabrir uma troca de catálogo tem que trazer o alimento de volta.
   *
   * A aba já abria em "Catálogo" — ela lê `trocaAtual.origem` —, mas `alimento`
   * nascia `null`, e sem alimento não há quantidade, não há medida e não há
   * botão de confirmar: a pessoa via a aba certa, um campo vazio e nenhuma
   * ação. Era o "o botão de trocar não funciona". `texto` e `kcalTexto` já
   * eram reidratados; só o catálogo ficou de fora.
   *
   * Vem por id, e não da busca por nome: o nome guardado é o rótulo da troca,
   * e procurar por ele traria o alimento errado (ou nenhum) quando o catálogo
   * tem homônimos.
   */
  const { data: doBanco } = useFoodsByIds(
    jaDoCatalogo?.food_id != null ? [jaDoCatalogo.food_id] : [],
  );
  useEffect(() => {
    if (!jaDoCatalogo || jaDoCatalogo.food_id === null || alimento !== null) return;
    const f = doBanco?.get(jaDoCatalogo.food_id);
    if (f) {
      setAlimento(f);
      // A quantidade já veio da troca gravada: a sugestão não pode reescrevê-la.
      tocouNaQtd.current = true;
    }
  }, [doBanco, jaDoCatalogo, alimento]);

  const { data: medidas = [], isSuccess: medidasProntas } = useMeasures(alimento?.id ?? null);

  /** O usuário já mexeu na quantidade? Então a sugestão não manda mais. */
  const tocouNaQtd = useRef(false);

  // Abre em "1 fatia", não em "100" — a mesma cortesia que o diário faz. Espera
  // as medidas chegarem, porque elas decidem a unidade.
  //
  // E não escreve por cima do que já foi digitado: as medidas vêm do servidor,
  // e podem chegar DEPOIS de a pessoa ter apagado o campo e digitado o número
  // dela. Sem esta guarda, "2" vira "12" — a sugestão reaparecendo na frente.
  useEffect(() => {
    if (!alimento || !medidasProntas || tocouNaQtd.current) return;
    const s = sugerirPorcao(alimento, medidas);
    setQtd(formatarNumero(s.count));
    setMedidaId(s.measure ? String(s.measure.id) : BASE);
  }, [alimento, medidas, medidasProntas]);

  // As opções que o plano prevê para ESTA linha. Item sem categoria não tem
  // uma resposta certa, então recebe tudo o que o bloco autoriza — melhor
  // escolher entre demais do que não ter caminho nenhum.
  const doPlano = item.categoria
    ? trocasPara(swaps, bloco.nome, item.categoria)
    : [...trocasDoBloco(swaps, bloco.nome).values()].flat();

  // "Trocar" pela segunda vez sugeriria substituir a primeira. O verbo tem que
  // dizer o que o toque faz.
  const verbo = escolhidas.length > 0 ? "Adicionar" : "Trocar por";

  const medida = medidas.find((m) => String(m.id) === medidaId) ?? null;
  const contagem = Number(qtd.replace(",", ".")) || 0;
  const qtyG = medida ? resolverQtdBase(medida.qty_base, contagem) : contagem;
  const kcalCatalogo = alimento && qtyG > 0 ? macrosDoEntry(alimento, qtyG).kcal : 0;

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

        <Segmented
          opcoes={ABAS}
          valor={aba}
          onChange={(v) => { setAba(v); onAba(v); }}
          rotulo="De onde vem a troca"
        />

        {aba === "plano" &&
          (doPlano.length > 0 ? (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {[...doPlano].sort((a, b) => a.kcal - b.kcal).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onEscolher({ swap_id: s.id })}
                    aria-pressed={trocaAtual?.swap_id === s.id}
                    className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted aria-pressed:bg-tint-primary"
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
          ) : (
            <p className="t-caption py-6 text-center">
              Seu plano não lista substituição para esta linha. Use o catálogo ou escreva o que
              você comeu.
            </p>
          ))}

        {aba === "catalogo" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="troca-busca">Alimento</Label>
              <Input
                id="troca-busca"
                value={termo}
                autoComplete="off"
                placeholder="Buscar alimento…"
                onChange={(e) => {
                  setTermo(e.target.value);
                  setAlimento(null);
                  // Alimento novo, sugestão nova: o que foi digitado era do
                  // anterior.
                  tocouNaQtd.current = false;
                }}
              />
            </div>

            {!alimento && resultados.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {resultados.slice(0, 12).map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => { setAlimento(f); setTermo(f.nome); }}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">{f.nome}</span>
                      <span className="t-caption shrink-0 tabular-nums">
                        {Math.round(f.kcal)} kcal/{f.base_qty_g} {f.base_unit}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {alimento && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="troca-qtd">Quantidade</Label>
                    <Input
                      id="troca-qtd"
                      inputMode="decimal"
                      value={qtd}
                      onChange={(e) => { tocouNaQtd.current = true; setQtd(e.target.value); }}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="troca-medida">Medida</Label>
                    <select
                      id="troca-medida"
                      value={medidaId}
                      onChange={(e) => setMedidaId(e.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                      <option value={BASE}>{alimento.base_unit}</option>
                      {medidas.map((m) => (
                        <option key={m.id} value={String(m.id)}>{m.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="t-caption tabular-nums">
                  {qtyG > 0
                    ? `${formatarNumero(Math.round(qtyG))} ${alimento.base_unit} · ≈ ${Math.round(kcalCatalogo)} kcal`
                    : "Informe a quantidade."}
                </p>

                <Button
                  block
                  disabled={qtyG <= 0}
                  onClick={() =>
                    onEscolher({
                      food_id: alimento.id,
                      qty_g: qtyG,
                      measure_id: medida ? medida.id : null,
                      medidas: medida ? contagem : null,
                      kcal: kcalCatalogo,
                    })
                  }
                >
                  {verbo} {alimento.nome}
                </Button>
              </>
            )}
          </div>
        )}

        {aba === "texto" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="troca-texto">O que você comeu</Label>
              <Input
                id="troca-texto"
                value={texto}
                placeholder="Pão da padaria da esquina"
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="troca-kcal">Calorias (opcional)</Label>
              <Input
                id="troca-kcal"
                inputMode="numeric"
                value={kcalTexto}
                placeholder="—"
                onChange={(e) => setKcalTexto(e.target.value)}
              />
            </div>
            {/* Honestidade, não desencorajamento: sem número o app não tem o
                que somar, e é melhor dizer isso do que contar zero em silêncio. */}
            <p className="t-caption">
              Sem calorias, a troca aparece na sua refeição mas não entra no balanço do dia.
            </p>
            <Button
              block
              disabled={texto.trim() === ""}
              onClick={() =>
                onEscolher({
                  texto: texto.trim(),
                  kcal: kcalTexto.trim() === "" ? null : Number(kcalTexto.replace(",", ".")),
                })
              }
            >
              {escolhidas.length > 0 ? "Adicionar" : "Trocar"}
            </Button>
          </div>
        )}

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
  trocas: TrocaDeItem[];
  feito: boolean;
  /** Substitui tudo na linha — o que a aba "Do plano" faz. */
  onTrocar: (itemId: number, e: Omit<TrocaEntrada, "data" | "block_id" | "item_id">) => void;
  /** Acrescenta sem tirar os que já estavam — catálogo e texto livre. */
  onAdicionar: (itemId: number, e: Omit<TrocaEntrada, "data" | "block_id" | "item_id">) => void;
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
  const foraDoBalanco = new Set(itensResolvidos(itens, trocas).semAlimento.map((i) => i.id));

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
  function escolher(itemId: number, e: Omit<TrocaEntrada, "data" | "block_id" | "item_id">) {
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
