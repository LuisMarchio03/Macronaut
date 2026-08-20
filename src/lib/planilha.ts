import { parseCsv } from "@/domain/csv";
import { chave } from "@/domain/plano-parse";
import type { Abas, DietPlan, Grade } from "@/domain/plano-types";

/**
 * A ÚNICA camada que conhece o formato do arquivo.
 *
 * Tudo depois daqui opera sobre matriz de células, então os parsers do plano
 * são puros e testáveis sem tocar em xlsx — e um formato novo entra aqui sem
 * mexer em nenhuma regra de negócio.
 */

export class ArquivoInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ArquivoInvalido";
  }
}

/** O que foi lido, mais de que formato veio — é o que `diet_plans.origem` grava. */
export interface Planilha extends Abas {
  origem: Extract<DietPlan["origem"], "xlsx" | "csv">;
}

const NOMES_DE_ABA = {
  plano: ["plano", "dieta", "cardapio", "refeicoes"],
  macros: ["macros", "macro", "macronutrientes"],
  substituicoes: ["substituicoes", "substituicao", "trocas", "alternativas"],
};

function acharAba(abas: Map<string, Grade>, candidatos: string[]): Grade | null {
  for (const [nome, grade] of abas) {
    if (candidatos.includes(chave(nome))) return grade;
  }
  return null;
}

/**
 * `read-excel-file` é carregado sob demanda: são ~40KB que só interessam a
 * quem abre a tela de importação, e não têm por que pesar na abertura do app.
 */
async function lerXlsx(arquivo: File): Promise<Map<string, Grade>> {
  let readXlsxFile: typeof import("read-excel-file/browser").default;
  try {
    ({ default: readXlsxFile } = await import("read-excel-file/browser"));
  } catch {
    // Falhar aqui não é culpa do arquivo — é o pedaço do app que lê planilha
    // que não chegou. Acontece quando o app foi atualizado com a aba aberta e
    // o endereço do pedaço antigo deixou de existir. Chamar isso de "arquivo
    // corrompido" manda a pessoa mexer na planilha, que está impecável.
    throw new ArquivoInvalido(
      "Não consegui carregar o leitor de planilhas. Feche e abra o app " +
        "(ou recarregue a página) e tente de novo.",
    );
  }

  try {
    const abas = await readXlsxFile(arquivo, { trim: true });
    return new Map(abas.map((a) => [a.sheet, a.data as Grade]));
  } catch {
    throw new ArquivoInvalido(
      "Não consegui abrir a planilha. Confira se o arquivo não está corrompido e se foi salvo como .xlsx.",
    );
  }
}

export function ehXlsx(nome: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(nome);
}

/* ── quem é o arquivo, por dentro ───────────────────────────────────
   O nome do arquivo é um palpite, não um fato. Escolhido do Drive, do
   WhatsApp ou do "Arquivos" no celular, a MESMA planilha chega ora como
   "plano.xlsx", ora como "documento", ora como "Download (3)". Decidir
   pelo nome recusava calado um arquivo perfeitamente válido — e do lado
   de cá isso aparecia como "escolhi a planilha e não aconteceu nada".
   ────────────────────────────────────────────────────────────────── */

/** `.xlsx` e `.xlsm` são arquivos zip: todo zip começa com "PK\x03\x04". */
const ZIP = [0x50, 0x4b, 0x03, 0x04];
/** Excel 97-2003 (`.xls`) é um documento OLE2 — outro formato, outro leitor. */
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function comeca(bytes: Uint8Array, assinatura: number[]): boolean {
  return assinatura.every((b, i) => bytes[i] === b);
}

/** Texto não tem byte zero; binário quase sempre tem, e logo no começo. */
function pareceTexto(bytes: Uint8Array): boolean {
  return !bytes.includes(0);
}

/** As extensões que este leitor promete abrir. */
const ACEITAS = ["xlsx", "xlsm", "csv", "tsv", "txt"];

/** A extensão do nome, ou `null` quando o arquivo chegou sem nenhuma. */
function extensao(nome: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(nome);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Lê um arquivo e devolve as três abas do plano.
 *
 * Num `.csv` só existe uma tabela; ela é tratada como a aba Plano, e as outras
 * duas ficam nulas — importar só o plano é válido, o usuário só perde as
 * trocas e a divisão de macros (que viram avisos, não erros).
 */
export async function lerAbas(arquivo: File): Promise<Planilha> {
  if (arquivo.size === 0) {
    throw new ArquivoInvalido(
      `"${arquivo.name}" veio vazio. Isso costuma acontecer ao escolher o arquivo ` +
        "direto de um app de nuvem: baixe a planilha para o aparelho e escolha de novo.",
    );
  }

  const inicio = new Uint8Array(await arquivo.slice(0, 16).arrayBuffer());
  const ext = extensao(arquivo.name);

  if (comeca(inicio, OLE2) || ext === "xls") {
    throw new ArquivoInvalido(
      "Esta planilha está no formato antigo do Excel (.xls). Abra no Excel ou no " +
        "Google Sheets e salve como .xlsx — aí eu consigo ler.",
    );
  }

  // Um nome que anuncia OUTRO formato é recusado antes de olhar o conteúdo:
  // um .docx também é um zip por dentro, e tentar lê-lo como planilha só
  // trocaria uma recusa clara por uma confusa.
  if (ext !== null && !ACEITAS.includes(ext)) {
    throw new ArquivoInvalido(
      `Não sei ler "${arquivo.name}". Envie um arquivo .xlsx ou .csv.`,
    );
  }

  if (comeca(inicio, ZIP)) {
    const abas = await lerXlsx(arquivo);
    if (abas.size === 0) throw new ArquivoInvalido("A planilha não tem nenhuma aba.");

    // Sem aba chamada "Plano", a primeira é a candidata: quem monta a própria
    // planilha do zero raramente batiza a aba, e recusar por causa do nome seria
    // rigor sem propósito.
    return {
      origem: "xlsx",
      plano: acharAba(abas, NOMES_DE_ABA.plano) ?? [...abas.values()][0],
      macros: acharAba(abas, NOMES_DE_ABA.macros),
      substituicoes: acharAba(abas, NOMES_DE_ABA.substituicoes),
    };
  }

  if (ehXlsx(arquivo.name)) {
    throw new ArquivoInvalido(
      `"${arquivo.name}" tem nome de planilha do Excel, mas por dentro não é uma. ` +
        "Abra o arquivo e salve de novo como .xlsx, ou exporte como .csv.",
    );
  }

  if (pareceTexto(inicio)) {
    const plano = parseCsv(await arquivo.text());
    return { origem: "csv", plano, macros: null, substituicoes: null };
  }

  throw new ArquivoInvalido(
    `Não sei ler "${arquivo.name}". Envie a planilha da sua dieta em .xlsx ou .csv.`,
  );
}
