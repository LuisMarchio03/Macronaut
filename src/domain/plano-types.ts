/** Tipos do plano alimentar. Espelham `src/db/schema.sql`. */

export type TipoBloco = "refeicao" | "agua" | "suplemento";

export type CategoriaItem =
  | "proteina"
  | "carboidrato"
  | "fruta"
  | "gordura"
  | "vegetal";

export interface DietPlan {
  id: number;
  nome: string;
  origem: "xlsx" | "csv" | "manual";
  kcal_min: number | null;
  kcal_max: number | null;
  prot_alvo_g: number | null;
  agua_ml_alvo: number | null;
  ativo: boolean;
  created_at: string;
}

export interface PlanBlock {
  id: number;
  plan_id: number;
  tipo: TipoBloco;
  nome: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  ancora: string | null;
  kcal_alvo: number | null;
  ml_alvo: number | null;
  observacao: string | null;
  ordem: number;
}

export interface PlanItem {
  id: number;
  block_id: number;
  texto: string;
  categoria: CategoriaItem | null;
  food_id: number | null;
  qty_g: number | null;
  ordem: number;
}

export interface PlanMacro {
  id: number;
  plan_id: number;
  block_nome: string;
  prot_g: number;
  carb_g: number;
  gord_g: number;
  kcal: number;
}

export interface PlanSwap {
  id: number;
  plan_id: number;
  block_nome: string;
  categoria: string;
  alimento: string;
  porcao: string;
  qty_g: number | null;
  kcal: number;
  food_id: number | null;
}

/**
 * Uma troca de um dia, já resolvida para a tela.
 *
 * Denormalizada de propósito: `plan_item_swaps` guarda só a referência, e
 * `nome`/`porcao` moram em três tabelas diferentes conforme a origem. Sem isto
 * toda tela que desenha uma troca precisaria saber fazer o mesmo join.
 */
export interface Troca {
  id: number;
  data: string;
  block_id: number;
  /**
   * A linha que ela substitui — ou `null`, e aí ela substitui a REFEIÇÃO.
   *
   * As duas moram na mesma tabela porque são a mesma afirmação ("no lugar
   * disto, comi aquilo") em escopos diferentes. O que muda é o que ela apaga:
   * uma lista de refeição varre as trocas de linha do bloco, porque uma
   * refeição está num modo ou no outro.
   */
  item_id: number | null;
  /** De onde a troca veio — é o que a folha usa para reabrir na aba certa. */
  origem: "plano" | "catalogo" | "texto";
  /** `plan_swaps.id` quando a origem é o plano; identifica a opção escolhida. */
  swap_id: number | null;
  /** O que entrou no lugar. */
  nome: string;
  /** '2 col. sopa (30g)', '120 g' — `null` quando não dá para dizer. */
  porcao: string | null;
  /** `null` = desconhecida. A tela diz isso; não conta como zero. */
  kcal: number | null;
  /**
   * Você não comeu esta linha, e não comeu outra coisa no lugar.
   *
   * Mora na mesma tabela das trocas por ser uma resposta sobre a mesma linha
   * no mesmo dia, mas não é uma troca — é a ausência de uma. `trocasDoItem` a
   * filtra fora; quem quer saber usa `itemDispensado`.
   */
  dispensado: boolean;

  /* ── o que permite lançar no diário ──
     `null` quando a troca não casa com nenhum alimento do catálogo: texto
     livre, ou substituição que o importador da planilha não conseguiu casar. */
  food_id: number | null;
  qty_g: number | null;
  measure_id: number | null;
  medidas: number | null;
}

/** O que "Comi" vai gravar em `food_entries` por um item do plano. */
export interface LancamentoDoPlano {
  /** `null` quando o lançamento veio da lista que substituiu a refeição. */
  item_id: number | null;
  food_id: number;
  qty_g: number;
  measure_id: number | null;
  medidas: number | null;
  /** O texto que a pessoa lê no diário. */
  label: string;
}

export interface PlanCheck {
  id: number;
  user_id: number;
  plan_id: number;
  data: string;
  block_id: number;
  feito: boolean;
  swap_id: number | null;
  created_at: string;
}

/* ── Rascunho: o que o parser produz, antes de existir no banco ── */

export interface RascunhoItem {
  texto: string;
  categoria: CategoriaItem | null;
}

export interface RascunhoBloco {
  tipo: TipoBloco;
  nome: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  ancora: string | null;
  kcal_alvo: number | null;
  ml_alvo: number | null;
  observacao: string | null;
  itens: RascunhoItem[];
}

export interface RascunhoMeta {
  nome: string;
  kcal_min: number | null;
  kcal_max: number | null;
  prot_alvo_g: number | null;
  agua_ml_alvo: number | null;
  /** Linhas de resumo da planilha, guardadas para validar contra a soma. */
  total_kcal_declarado: { min: number; max: number } | null;
  agua_total_declarada_ml: number | null;
}

export interface RascunhoMacro {
  block_nome: string;
  prot_g: number;
  carb_g: number;
  gord_g: number;
  kcal: number;
}

export interface RascunhoSwap {
  block_nome: string;
  categoria: string;
  alimento: string;
  porcao: string;
  qty_g: number | null;
  kcal: number;
}

export interface RascunhoPlano {
  meta: RascunhoMeta;
  blocos: RascunhoBloco[];
  macros: RascunhoMacro[];
  substituicoes: RascunhoSwap[];
}

/**
 * Erro impede a importação; aviso não.
 *
 * A distinção existe porque uma planilha preenchida à mão quase sempre tem
 * alguma imprecisão, e recusar o arquivo inteiro por causa de um horário mal
 * escrito seria pior do que importar e apontar o que ficou estranho.
 */
export interface Problema {
  nivel: "erro" | "aviso";
  onde: string;
  mensagem: string;
}

export interface ResultadoValidacao {
  erros: Problema[];
  avisos: Problema[];
}

/** Matriz de células de uma aba, como sai de qualquer leitor de planilha. */
export type Celula = string | number | boolean | Date | null;
export type Grade = Celula[][];

export interface Abas {
  plano: Grade;
  macros: Grade | null;
  substituicoes: Grade | null;
}
