import { normalizar } from "./texto.ts";

/** Uma linha do tabelamedidas_bd.xls do IBGE (POF 2008-2009), já convertido. */
export interface PofLinha {
  codigo: string;      // código do alimento na POF
  descricao: string;   // "ARROZ (POLIDO, PARBOILIZADO)"
  preparacao: string;  // "CRU(A)" | "COZIDO(A)" | "CROZIDO(A)" (sic) | ...
  medida: string;      // "COLHER DE SOPA"
  gramas: number;      // 25
}

/** O que precisamos de um item da TACO para casar. */
export interface TacoRef {
  nome: string;        // "Arroz, integral, cozido"
}

/**
 * O XLS do IBGE usa vírgula como separador decimal ("56,3"). `Number("56,3")`
 * daria NaN silenciosamente e viraria porção 0 — daí a conversão explícita.
 */
export function numeroPof(v: string): number {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * TACO nomeia como `Cabeça, qualificador, estado` — "Arroz, integral, cozido".
 * A cabeça é o substantivo que identifica o alimento.
 */
export function cabecaTaco(nome: string): string {
  return normalizar(nome.split(",")[0] ?? "");
}

/**
 * POF nomeia como `NOME AGREGADO (variantes)` — "ARROZ (POLIDO, PARBOILIZADO)".
 * A cabeça é a primeira palavra, antes de qualquer parêntese ou barra.
 */
export function cabecaPof(descricao: string): string {
  const primeira = String(descricao ?? "").trim().split(/[\s(/]/)[0] ?? "";
  return normalizar(primeira);
}

/**
 * Estados que a TACO põe no fim do nome e que a POF põe em coluna própria.
 * Chave = forma normalizada como aparece na TACO; valor = forma canônica.
 */
const ESTADOS: Record<string, string> = {
  cru: "cru", crua: "cru", crus: "cru", cruas: "cru",
  cozido: "cozido", cozida: "cozido", cozidos: "cozido", cozidas: "cozido",
  frito: "frito", frita: "frito", fritos: "frito", fritas: "frito",
  grelhado: "grelhado", grelhada: "grelhado",
  assado: "assado", assada: "assado",
  refogado: "refogado", refogada: "refogado",
};

/**
 * Estado canônico do último segmento do nome da TACO, ou null se não houver.
 *
 * O match exato não basta: a TACO cola qualificadores no estado, e são
 * justamente os ovos — o exemplo canônico de por que preparo importa (1 unidade
 * = 45 g cru, 50 g frito). Medido no dado real (591 itens), 5 alimentos só são
 * detectados com tokenização:
 *   "Ovo, de galinha, inteiro, cozido/10minutos"
 *   "Cuscuz, de milho, cozido com sal"
 *   "Salada, de legumes, cozida no vapor"
 *
 * Perder o estado aqui não é inofensivo: `preparacaoCasa(null, ...)` aceita
 * QUALQUER preparação, então o ovo casaria as linhas de cru E de frito do mesmo
 * código POF, e o dedup por nome de medida em `casar()` deixaria "1 unidade"
 * valer 45 ou 50 g conforme a ordem das linhas — silenciosamente.
 *
 * Tokenizar não gera falso positivo: verificado nos 591 itens, exatamente esses
 * 5 mudam (null -> cozido) e nenhum outro. Os nulls restantes são não-preparos
 * de verdade ("maisena", "recheado com chocolate", "cream cracker").
 */
export function estadoTaco(nome: string): string | null {
  const partes = nome.split(",");
  if (partes.length < 2) return null;
  const ultimo = normalizar(partes[partes.length - 1]);
  if (ESTADOS[ultimo]) return ESTADOS[ultimo];
  for (const token of ultimo.split(/[\s/]+/)) {
    if (ESTADOS[token]) return ESTADOS[token];
  }
  return null;
}

/**
 * Palavras que não discriminam nada e só gerariam ruído no estreitamento.
 */
const IRRELEVANTES = new Set(["de", "da", "do", "com", "sem", "e", "a", "o", "em", "tipo", "ao", "na", "no"]);

/**
 * Qualificadores do nome da TACO: os segmentos do meio, fora a cabeça e o
 * estado. Em "Carne, bovina, acém, moído, cozido" -> ["bovina", "acem", "moido"].
 *
 * Existe porque a cabeça sozinha é grosseira demais: "carne" casa TODA carne da
 * POF. Medido — "Carne, bovina, contra-filé, à milanesa" dava 155 candidatos, e
 * a mediana geral era 8 (p90 27). Os qualificadores são exatamente o que
 * discrimina, e a TACO os põe no nome enquanto a POF os põe na descrição.
 *
 * NÃO é fuzzy matching: é presença LITERAL de palavra, não similaridade, sem
 * score e sem threshold. E não decide nada sozinho — só encurta a lista que o
 * usuário vai ver. Quem escolhe continua sendo ele.
 */
export function qualificadoresTaco(nome: string): string[] {
  const partes = nome.split(",").slice(1); // fora a cabeça
  const estado = estadoTaco(nome);
  return partes
    .map((p) => normalizar(p))
    .filter((p) => {
      if (estado === null) return true;
      // descarta o segmento que É o estado ("cozido", "cozido/10minutos")
      return !p.split(/[\s/]+/).some((t) => ESTADOS[t] === estado);
    })
    .flatMap((p) => p.split(/[\s/]+/))
    .filter((w) => w.length > 2 && !IRRELEVANTES.has(w));
}

/**
 * Preparações da POF por estado canônico. Strings MEDIDAS no arquivo real
 * (`tabelamedidas_bd.xls`, 11.801 linhas) — não inventadas:
 *
 *   NAO SE APLICA                 6429 (54%)  <- ver SEM_PREPARO abaixo
 *   CROZIDO(A)                    1232 (10%)
 *   FRITO(A)                       818 ( 6%)
 *   ASSADO(A)                      636 ( 5%)
 *   REFOGADO(A)                    502 ( 4%)
 *   CRU(A)                         437 ( 3%)
 *   ENSOPADO                       419 ( 3%)  <- prato, não estado: não casa
 *   GRELHADO(A)/BRASA/CHURRASCO    373 ( 3%)
 *   MOLHO VERMELHO, EMPANADO(A)/A MILANESA, SOPA, MINGAU...  <- idem
 *
 * `CROZIDO(A)` é typo do PRÓPRIO IBGE, e é a grafia ÚNICA: `COZIDO(A)` não
 * existe no arquivo. Alias explícito em vez de normalização automática —
 * remover o "R" quebraria "CRU".
 *
 * `GRELHADO(A)/BRASA/CHURRASCO` é a grafia real e completa; o alias precisa
 * dela inteira, senão os 22 alimentos grelhados da TACO caem todos em semMatch.
 *
 * ENSOPADO/MOLHO VERMELHO/EMPANADO/SOPA/MINGAU são PRATOS diferentes, não
 * estados do mesmo alimento — a TACO não os modela, e casá-los seria erro.
 */
const PREPARACOES: Record<string, string[]> = {
  cru: ["cru(a)", "cru", "crua"],
  cozido: ["cozido(a)", "crozido(a)", "cozido", "cozida"],
  frito: ["frito(a)", "frito", "frita"],
  grelhado: ["grelhado(a)", "grelhado", "grelhado(a)/brasa/churrasco"],
  assado: ["assado(a)", "assado"],
  refogado: ["refogado(a)", "refogado"],
};

/**
 * 54% das linhas da POF. Não significa "preparação desconhecida" — significa
 * que o alimento NÃO TEM dimensão de preparo (arroz é arroz; a colher pesa
 * igual). É curinga do lado da POF, espelhando o `estado === null` do lado da
 * TACO.
 *
 * Tratá-la como incompatível foi o defeito original: os 14 códigos de ARROZ da
 * POF usam EXCLUSIVAMENTE `NAO SE APLICA`, então "Arroz, integral, cozido" — o
 * 1º item do taco.json — não casava com nada. Medido: o semMatch caía de 43%
 * para 19% ao tratar como curinga (143 alimentos a mais ganham medida).
 */
const SEM_PREPARO = "nao se aplica";

/**
 * Estado null = a TACO não declarou preparo ("Pão, trigo, forma, integral").
 * Nesse caso qualquer preparação da POF serve: não temos como discriminar, e
 * descartar seria pior que aceitar.
 */
export function preparacaoCasa(estado: string | null, preparacao: string): boolean {
  const alvo = normalizar(preparacao);
  if (alvo === SEM_PREPARO) return true;
  if (estado === null) return true;
  return (PREPARACOES[estado] ?? []).includes(alvo);
}

export interface MedidaCasada {
  nome: string;       // "colher de sopa" (normalizado, vira rótulo de UI)
  qty_base: number;   // 25
  pof_codigo: string;
}

export interface CandidatoPof {
  /**
   * Chave do candidato: `<código POF>|<preparação normalizada>`. NÃO é só o
   * código.
   *
   * Por quê: o mesmo código com preparações diferentes dá gramas CONFLITANTES
   * para a mesma medida. Medido no arquivo real: 156 conflitos, o pior sendo
   * "prato de sobremesa" de banana doce em barra valendo 170 g numa preparação
   * e 22 g noutra — 8x. Agrupar só por código faria a ORDEM DAS LINHAS DO XLS
   * escolher, silenciosamente, e o alimento ainda cairia em `confirmadas`, que
   * pula a desambiguação do usuário.
   *
   * Com a chave composta, esses casos viram `candidatas` e o usuário decide —
   * spec, D3: dado ambíguo é decisão dele, não da ordem do arquivo. Custo
   * medido: 30 alimentos migram de confirmada para candidata (194 -> 164), e
   * os conflitos silenciosos vão a ZERO.
   */
  pof_codigo: string;
  pof_descricao: string;   // "BANANA DOCE EM BARRA · CRU(A)" — mostrado na desambiguação
  medidas: MedidaCasada[];
}

export interface ResultadoTaco {
  nome: string;            // nome do alimento na TACO
  candidatos: CandidatoPof[];
}

export interface ResultadoMatching {
  confirmadas: ResultadoTaco[];  // 1 candidato → medidas entram como 'confirmada'
  candidatas: ResultadoTaco[];   // >1 candidato → medidas entram como 'candidata'
  semMatch: string[];            // 0 candidatos → fallback manual
}

/**
 * Casa TACO↔POF por cabeça + preparação. NUNCA por similaridade de string:
 * fuzzy matching sobre estes dados dá 13,7% de acerto e produz erros como
 * "Manga, Haden, crua" → "ASA DE PERU" (score 0.59). Ver spec, decisão D3.
 *
 * Baldes: exatamente 1 código POF → confirmada; >1 → candidata (o usuário
 * desambigua na 1ª vez que registrar); 0 → semMatch (digita as gramas).
 */
export function casar(taco: TacoRef[], pof: PofLinha[]): ResultadoMatching {
  // Agrupa a POF por cabeça uma vez só: o loop da TACO é O(n) em cima disso.
  const porCabeca = new Map<string, PofLinha[]>();
  for (const linha of pof) {
    const c = cabecaPof(linha.descricao);
    if (!c) continue;
    const lista = porCabeca.get(c);
    if (lista) lista.push(linha);
    else porCabeca.set(c, [linha]);
  }

  const out: ResultadoMatching = { confirmadas: [], candidatas: [], semMatch: [] };

  for (const item of taco) {
    const cabeca = cabecaTaco(item.nome);
    const estado = estadoTaco(item.nome);
    const linhas = (porCabeca.get(cabeca) ?? []).filter((l) =>
      preparacaoCasa(estado, l.preparacao),
    );

    // Agrupa por (código, preparação) — NÃO só por código. Ver o comentário de
    // `CandidatoPof.pof_codigo`: preparações diferentes do mesmo código dão
    // gramas conflitantes para a mesma medida (156 casos reais), e agrupar só
    // por código deixaria a ordem do arquivo escolher em silêncio.
    const porCandidato = new Map<string, CandidatoPof>();
    for (const l of linhas) {
      if (l.gramas <= 0) continue; // schema: CHECK (qty_base > 0)
      const chave = `${l.codigo}|${normalizar(l.preparacao)}`;
      let cand = porCandidato.get(chave);
      if (!cand) {
        cand = {
          pof_codigo: chave,
          pof_descricao: `${l.descricao} · ${l.preparacao}`,
          medidas: [],
        };
        porCandidato.set(chave, cand);
      }
      const nome = normalizar(l.medida);
      // Dentro de um mesmo (código, preparação) a medida repetida é duplicata
      // real do arquivo, não conflito de semântica: a primeira ganha.
      if (cand.medidas.some((m) => m.nome === nome)) continue;
      cand.medidas.push({ nome, qty_base: l.gramas, pof_codigo: chave });
    }

    const candidatos = [...porCandidato.values()].filter((c) => c.medidas.length > 0);

    // Estreita por qualificador. A cabeça sozinha põe TODA carne da POF como
    // candidata de "Carne, bovina, acém, moído" — 155 opções para o usuário
    // escolher não é uma decisão, é uma lista telefônica.
    //
    // Medido: mediana de candidatos cai de 8 para 3, p90 de 27 para 8, máx de
    // 155 para 35, e os alimentos com no máximo 3 opções sobem de 35% para 67%.
    //
    // Se NENHUM candidato menciona qualificador, mantém todos: estreitar até
    // zero perderia o alimento inteiro, o que é pior que mostrar demais.
    const quals = qualificadoresTaco(item.nome);
    const estreitados = quals.length === 0 ? candidatos : candidatos.filter((c) => {
      const d = normalizar(c.pof_descricao);
      return quals.some((q) => d.includes(q));
    });
    const finais = estreitados.length > 0 ? estreitados : candidatos;

    if (finais.length === 0) out.semMatch.push(item.nome);
    else if (finais.length === 1) out.confirmadas.push({ nome: item.nome, candidatos: finais });
    else out.candidatas.push({ nome: item.nome, candidatos: finais });
  }

  return out;
}
