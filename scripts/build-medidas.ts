// Uso: node --experimental-strip-types scripts/build-medidas.ts
//
// Fonte: IBGE, Pesquisa de Orçamentos Familiares 2008-2009, "Tabela de Medidas
// Referidas para os Alimentos Consumidos no Brasil" (tabelamedidas_bd.xls).
// Dado estatístico público; citado no README. Ver ressalva de licença no spec.
import { readFileSync, writeFileSync } from "node:fs";
import { casar, numeroPof, type PofLinha, type CandidatoPof } from "../src/domain/matching-pof.ts";
import type { TacoItem } from "../src/domain/taco.ts";

export interface MedidasDeAlimento {
  alimento: string;                  // nome exato na TACO (chave do seed)
  status: "confirmada" | "candidata";
  candidatos: CandidatoPof[];
}

/** CSV com aspas: o IBGE tem vírgula DENTRO de campo ("ARROZ (POLIDO, PARBOILIZADO)"). */
function parseCsvLinha(linha: string): string[] {
  const out: string[] = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i++; }
      else dentroDeAspas = !dentroDeAspas;
    } else if (c === "," && !dentroDeAspas) {
      out.push(atual); atual = "";
    } else atual += c;
  }
  out.push(atual);
  return out;
}

const csv = readFileSync("scratchpad/tabelamedidas_bd.csv", "utf8");
const linhas = csv.split("\n").filter((l) => l.trim().length > 0);

// O cabeçalho NÃO é a 1ª linha: as primeiras trazem o título da publicação
// ("PESQUISA DE ORÇAMENTOS FAMILIARES 2008-2009") em células soltas. Acha a
// linha real pela presença de "PREPARA" em vez de assumir índice fixo — se o
// IBGE mudar o número de linhas de título, o script continua funcionando.
const iCabecalho = linhas.findIndex((l) =>
  parseCsvLinha(l).some((c) => c.toUpperCase().includes("PREPARA")),
);
if (iCabecalho < 0) throw new Error("cabeçalho não encontrado no CSV do IBGE");

// Espaços múltiplos são reais no arquivo: a coluna 8 é literalmente
// "QUANTIDADE    EM            GRAMAS". Colapsa antes de comparar.
const cabecalho = parseCsvLinha(linhas[iCabecalho]).map((h) =>
  h.trim().toUpperCase().replace(/\s+/g, " "),
);

function col(nome: string): number {
  const i = cabecalho.findIndex((h) => h.includes(nome));
  if (i < 0) {
    throw new Error(`coluna não encontrada no CSV do IBGE: ${nome}\nachei: ${cabecalho.join(" | ")}`);
  }
  return i;
}

// Nomes REAIS, conferidos no arquivo (não presumir — a versão anterior deste
// script procurava "DESCRIÇÃO DA MEDIDA" e "QUANTIDADE EM GRAMAS", que não
// existem, e explodia):
//   [0] CÓDIGO DO ALIMENTO          [5] DESCRIÇÃO DO TIPO DE MEDIDA
//   [1] DESCRIÇÃO DO ALIMENTO       [7] DESCRIÇÃO DO TIPO DE MEDIDA PADRÃO
//   [3] DESCRIÇÃO DA PREPARAÇÃO     [8] QUANTIDADE    EM            GRAMAS
const iCodigo = col("CÓDIGO DO ALIMENTO");
const iDescricao = col("DESCRIÇÃO DO ALIMENTO");
const iPreparacao = col("DESCRIÇÃO DA PREPARAÇÃO");
// "DESCRIÇÃO DO TIPO DE MEDIDA" casa a coluna 5 E a 7 ("... PADRÃO"); o
// findIndex devolve a 5, que é a que queremos. Não troque por busca exata sem
// conferir as duas.
const iMedida = col("DESCRIÇÃO DO TIPO DE MEDIDA");
const iGramas = col("QUANTIDADE EM GRAMAS");

const pof: PofLinha[] = linhas.slice(iCabecalho + 1).map((l) => {
  const c = parseCsvLinha(l);
  return {
    codigo: (c[iCodigo] ?? "").trim(),
    descricao: (c[iDescricao] ?? "").trim(),
    preparacao: (c[iPreparacao] ?? "").trim(),
    medida: (c[iMedida] ?? "").trim(),
    gramas: numeroPof(c[iGramas] ?? ""),  // "56,3" → 56.3
  };
}).filter((l) => l.codigo && l.descricao);

const taco = JSON.parse(readFileSync("src/data/taco.json", "utf8")) as TacoItem[];
const r = casar(taco.map((t) => ({ nome: t.nome })), pof);

const saida: MedidasDeAlimento[] = [
  ...r.confirmadas.map((t) => ({ alimento: t.nome, status: "confirmada" as const, candidatos: t.candidatos })),
  ...r.candidatas.map((t) => ({ alimento: t.nome, status: "candidata" as const, candidatos: t.candidatos })),
].sort((a, b) => a.alimento.localeCompare(b.alimento));

writeFileSync("src/data/medidas.json", JSON.stringify(saida, null, 0) + "\n");

console.log(
  `${pof.length} linhas da POF lidas. ` +
    `${r.confirmadas.length} alimentos confirmados, ` +
    `${r.candidatas.length} ambíguos (desambiguação na 1ª vez que registrar), ` +
    `${r.semMatch.length} sem match (fallback manual). ` +
    `${saida.length} escritos em src/data/medidas.json.`,
);
