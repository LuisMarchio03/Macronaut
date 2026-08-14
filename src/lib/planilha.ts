import { parseCsv } from "@/domain/csv";
import { chave } from "@/domain/plano-parse";
import type { Abas, Grade } from "@/domain/plano-types";

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
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const abas = await readXlsxFile(arquivo, { trim: true });
  return new Map(abas.map((a) => [a.sheet, a.data as Grade]));
}

export function ehXlsx(nome: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(nome);
}

export function ehCsv(nome: string): boolean {
  return /\.(csv|tsv|txt)$/i.test(nome);
}

/**
 * Lê um arquivo e devolve as três abas do plano.
 *
 * Num `.csv` só existe uma tabela; ela é tratada como a aba Plano, e as outras
 * duas ficam nulas — importar só o plano é válido, o usuário só perde as
 * trocas e a divisão de macros (que viram avisos, não erros).
 */
export async function lerAbas(arquivo: File): Promise<Abas> {
  if (ehCsv(arquivo.name)) {
    const texto = await arquivo.text();
    return { plano: parseCsv(texto), macros: null, substituicoes: null };
  }

  if (!ehXlsx(arquivo.name)) {
    throw new ArquivoInvalido(
      `Não sei ler "${arquivo.name}". Envie um arquivo .xlsx ou .csv.`,
    );
  }

  let abas: Map<string, Grade>;
  try {
    abas = await lerXlsx(arquivo);
  } catch (e) {
    throw new ArquivoInvalido(
      "Não consegui abrir a planilha. Confira se o arquivo não está corrompido e se foi salvo como .xlsx.",
    );
  }

  if (abas.size === 0) throw new ArquivoInvalido("A planilha não tem nenhuma aba.");

  // Sem aba chamada "Plano", a primeira é a candidata: quem monta a própria
  // planilha do zero raramente batiza a aba, e recusar por causa do nome seria
  // rigor sem propósito.
  const plano = acharAba(abas, NOMES_DE_ABA.plano) ?? [...abas.values()][0];

  return {
    plano,
    macros: acharAba(abas, NOMES_DE_ABA.macros),
    substituicoes: acharAba(abas, NOMES_DE_ABA.substituicoes),
  };
}
