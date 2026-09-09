import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { useFoods } from "@/hooks/use-foods";
import { useMeasures } from "@/hooks/use-food-measures";
import { macrosDoEntry } from "@/domain/nutrition";
import { sugerirPorcao } from "@/domain/medida-default";
import { formatarNumero, resolverQtdBase } from "@/domain/medidas";
import type { PlanSwap } from "@/domain/plano-types";
import type { Food } from "@/domain/types";
import type { TrocaEntrada } from "@/repositories/plano";

export const ROTULO: Record<string, string> = {
  proteina: "Proteína",
  carboidrato: "Carboidrato",
  fruta: "Fruta",
  gordura: "Gordura",
  vegetal: "Vegetal",
  outros: "Outros",
};

const BASE = "__base__"; // o <option> "na unidade base", como no diário

export type Aba = "plano" | "catalogo" | "texto";

const ABAS = [
  { valor: "plano" as const, label: "Do plano" },
  { valor: "catalogo" as const, label: "Catálogo" },
  { valor: "texto" as const, label: "Escrever" },
];

/**
 * As opções previstas, agrupadas.
 *
 * `categoria: null` desenha uma lista sem título — é o que o nível da LINHA
 * quer, porque ali as opções já vêm filtradas pela categoria dela. O nível da
 * refeição passa N grupos, com título, porque não há categoria para filtrar.
 */
export interface GrupoDoPlano {
  categoria: string | null;
  opcoes: PlanSwap[];
}

/** O que a folha grava, menos o que ela mesma preenche. */
export type Escolha = Omit<TrocaEntrada, "data" | "block_id" | "item_id">;

/**
 * As três origens de uma troca, num formulário só.
 *
 * "Do plano" é o caminho curto e o que o nutricionista autorizou, então abre
 * primeiro. Os outros dois existem porque a vida acontece: sem eles, o dia em
 * que você come outra coisa é um dia que o app perde inteiro.
 *
 * É o mesmo formulário nos dois níveis — trocar uma linha e trocar a refeição
 * inteira fazem a MESMA pergunta ("o que entrou no lugar?"), e só o que se faz
 * com a resposta difere. Duplicá-lo duplicaria também a limpeza depois de cada
 * alimento, que é o que faz "adicionar outro" funcionar.
 */
export function EscolherAlimento({
  aba,
  onAba,
  grupos,
  vazio,
  acrescenta,
  swapAtivo,
  onConfirmar,
}: {
  aba: Aba;
  onAba: (a: Aba) => void;
  grupos: GrupoDoPlano[];
  /**
   * O que dizer quando o plano não prevê nada.
   *
   * É prop porque a frase é do ESCOPO, não do formulário: "para esta linha"
   * mentiria no nível da refeição, e "para esta refeição" mentiria no da
   * linha.
   */
  vazio: string;
  /** O toque acrescenta a uma lista que já tem alguma coisa? Muda o verbo. */
  acrescenta: boolean;
  /** `plan_swaps.id` já escolhido, para o `aria-pressed`. */
  swapAtivo: number | null;
  onConfirmar: (e: Escolha) => void;
}) {
  /**
   * O formulário nasce VAZIO, mesmo onde já há escolhas.
   *
   * Enquanto uma linha comportava uma troca só, reabri-la reidratava o
   * alimento gravado para você corrigir a quantidade — e não fazer isso era o
   * bug do "botão de trocar não funciona": aba certa, campo vazio, nenhuma
   * ação visível. Com N alimentos, quem mostra o que já foi escolhido é a
   * lista de cima, com o × de cada um, e corrigir passou a ser remover e
   * escolher de novo. Reidratar aqui teria o efeito oposto: a lista de
   * resultados só aparece quando NÃO há alimento selecionado, então o campo
   * preenchido tornaria o segundo alimento inalcançável.
   */
  const [termo, setTermo] = useState("");
  const [alimento, setAlimento] = useState<Food | null>(null);
  const [qtd, setQtd] = useState("");
  const [medidaId, setMedidaId] = useState<string>(BASE);
  const [texto, setTexto] = useState("");
  const [kcalTexto, setKcalTexto] = useState("");

  const { data: resultados = [] } = useFoods(termo);
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

  // "Trocar" pela segunda vez sugeriria substituir a primeira. O verbo tem que
  // dizer o que o toque faz.
  const verbo = acrescenta ? "Adicionar" : "Trocar por";

  /**
   * Confirma e deixa o formulário pronto para o PRÓXIMO alimento.
   *
   * A lista de resultados só aparece quando não há alimento escolhido, então
   * sem esta limpeza "adicionar outro" exigia apagar o campo na mão — o
   * segundo alimento ficava inalcançável logo depois de o primeiro entrar.
   */
  function confirmar(e: Escolha) {
    onConfirmar(e);
    setTermo("");
    setAlimento(null);
    setQtd("");
    setMedidaId(BASE);
    setTexto("");
    setKcalTexto("");
    tocouNaQtd.current = false;
  }

  const medida = medidas.find((m) => String(m.id) === medidaId) ?? null;
  const contagem = Number(qtd.replace(",", ".")) || 0;
  const qtyG = medida ? resolverQtdBase(medida.qty_base, contagem) : contagem;
  const kcalCatalogo = alimento && qtyG > 0 ? macrosDoEntry(alimento, qtyG).kcal : 0;

  const semOpcoes = grupos.every((g) => g.opcoes.length === 0);

  return (
    <>
      <Segmented opcoes={ABAS} valor={aba} onChange={onAba} rotulo="De onde vem a troca" />

      {aba === "plano" &&
        (semOpcoes ? (
          <p className="t-caption py-6 text-center">{vazio}</p>
        ) : (
          <div className="space-y-3">
            {grupos
              .filter((g) => g.opcoes.length > 0)
              .map((g) => (
                <div key={g.categoria ?? "__todas__"}>
                  {g.categoria && (
                    <p className="t-caption mb-1">{ROTULO[g.categoria] ?? g.categoria}</p>
                  )}
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {[...g.opcoes]
                      .sort((a, b) => a.kcal - b.kcal)
                      .map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => confirmar({ swap_id: s.id })}
                            aria-pressed={swapAtivo === s.id}
                            className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted aria-pressed:bg-tint-primary"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {s.alimento}
                              </span>
                              {s.porcao && (
                                <span className="t-caption block truncate">{s.porcao}</span>
                              )}
                            </span>
                            <span className="t-caption shrink-0 tabular-nums">{s.kcal} kcal</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </div>
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
                    onClick={() => {
                      setAlimento(f);
                      setTermo(f.nome);
                    }}
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
                    onChange={(e) => {
                      tocouNaQtd.current = true;
                      setQtd(e.target.value);
                    }}
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
                      <option key={m.id} value={String(m.id)}>
                        {m.nome}
                      </option>
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
                  confirmar({
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
              confirmar({
                texto: texto.trim(),
                kcal: kcalTexto.trim() === "" ? null : Number(kcalTexto.replace(",", ".")),
              })
            }
          >
            {acrescenta ? "Adicionar" : "Trocar"}
          </Button>
        </div>
      )}
    </>
  );
}
