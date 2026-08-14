/**
 * Gera o template de plano alimentar em `public/`.
 *
 * Roda em build, não no navegador: escrever xlsx exige uma biblioteca inteira
 * que não tem por que pesar no bundle de um app que só precisa LER planilha. O
 * resultado é um arquivo estático servido como qualquer outro asset.
 *
 *   node --experimental-strip-types scripts/build-template.ts
 */
import writeXlsxFile from "write-excel-file/node";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = resolve(RAIZ, "public");

type Celula = { value: string | number | null; fontWeight?: "bold"; wrap?: boolean; span?: number };

const t = (value: string | number | null, extra: Partial<Celula> = {}): Celula => ({
  value,
  ...extra,
});
const b = (value: string): Celula => t(value, { fontWeight: "bold" });
const vazia: Celula[] = [];

/* ══════════════════════════════════════════════════════════════════
   ABA: Instruções
   ══════════════════════════════════════════════════════════════════ */

const INSTRUCOES: Celula[][] = [
  [b("COMO PREENCHER ESTE PLANO")],
  vazia,
  [t("Preencha as três abas seguintes e importe o arquivo no Macronaut em Mais → Plano.")],
  [t("Só a aba Plano é obrigatória. Sem Macros e Substituicoes o app funciona, você só perde")],
  [t("a divisão de macros por refeição e a sugestão de trocas.")],
  vazia,
  [b("ABA PLANO")],
  vazia,
  [b("Antes da tabela"), t("três linhas de meta, opcionais:")],
  [t(""), t("Meta Calórica Diária: 1700-2000 kcal"), t("aceita valor único ou faixa")],
  [t(""), t("Meta Proteína: ~150g")],
  [t(""), t("Meta Água: 3L/dia"), t("aceita 3L, 3000ml, 3 litros")],
  [t(""), t("A primeira linha que não for meta vira o nome do plano.")],
  vazia,
  [b("REFEIÇÃO"), t("o nome do bloco. Deixe EM BRANCO para continuar o bloco de cima —")],
  [t(""), t("é assim que uma refeição ganha vários alimentos.")],
  [t(""), t("Comece com 💧 ou escreva ÁGUA para o bloco virar período de hidratação.")],
  [t(""), t("Comece com 🥤 ou escreva CREATINA / WHEY / SUPLEMENTO para virar suplemento.")],
  [t(""), t("Nomes de refeição não podem se repetir (as outras abas casam por nome).")],
  [t(""), t("Blocos de água e suplemento PODEM se repetir.")],
  vazia,
  [b("HORÁRIO"), t("7h00 - 8h00   ·   12h00-13h00   ·   das 7h às 8h   ·   19:00")],
  [t(""), t("Ou um evento, se não houver hora fixa: Após almoço, Pré-treino, Ao acordar.")],
  vazia,
  [b("ALIMENTOS"), t("um alimento por linha. Use OU para dar alternativa:")],
  [t(""), t("1 fatia de pão integral OU 2 col. sopa aveia")],
  [t(""), t("Em bloco de ÁGUA, escreva o volume: 750ml (3-4 copos de 200ml)")],
  vazia,
  [b("CALORIAS"), t("~400 kcal   ·   400   ·   400-450 kcal. Só na linha que abre o bloco.")],
  vazia,
  [b("OBSERVAÇÕES"), t("texto livre, aparece junto do bloco no app.")],
  vazia,
  [b("Linhas de total"), t("TOTAL ESTIMADO e HIDRATAÇÃO TOTAL não viram blocos.")],
  [t(""), t("O app usa para conferir se as partes batem com o todo.")],
  vazia,
  [b("ABA MACROS")],
  [t(""), t("Uma linha por refeição. O nome precisa ser IGUAL ao da aba Plano.")],
  [t(""), t("A linha TOTAL DIÁRIO é ignorada — o app soma sozinho.")],
  vazia,
  [b("ABA SUBSTITUICOES")],
  [t(""), t("As trocas que o app oferece quando você toca em Trocar numa refeição.")],
  [t(""), t("Refeição: igual à aba Plano. Categoria: Proteína, Carboidrato, Fruta,")],
  [t(""), t("Gordura ou Vegetal — precisa combinar com o alimento que vai substituir.")],
  vazia,
  [b("DICA")],
  [t(""), t("Apague as linhas de exemplo antes de importar. Elas estão aí só de modelo.")],
];

/* ══════════════════════════════════════════════════════════════════
   ABA: Plano (exemplo)
   ══════════════════════════════════════════════════════════════════ */

const PLANO: Celula[][] = [
  [b("MEU PLANO ALIMENTAR")],
  [t("Meta Calórica Diária: 1800-2000 kcal")],
  [t("Meta Proteína: ~150g")],
  [t("Meta Água: 3L/dia")],
  vazia,
  [b("REFEIÇÃO"), b("HORÁRIO"), b("ALIMENTOS"), b("CALORIAS"), b("OBSERVAÇÕES")],
  [t("Café da Manhã"), t("7h00 - 8h00"), t("3 ovos mexidos com espinafre"), t("~400 kcal"), t(null)],
  [t(null), t(null), t("1 fatia de pão integral OU 2 col. sopa aveia"), t(null), t(null)],
  [t(null), t(null), t("1 fruta média"), t(null), t(null)],
  vazia,
  [t("💧 ÁGUA"), t("8h00 - 12h00"), t("750ml (3-4 copos de 200ml)"), t(null), t("Ao longo da manhã")],
  vazia,
  [t("Almoço"), t("12h00 - 13h00"), t("120g de frango grelhado"), t("~500 kcal"), t(null)],
  [t(null), t(null), t("3 col. sopa de arroz integral OU batata-doce"), t(null), t(null)],
  [t(null), t(null), t("Salada à vontade"), t(null), t(null)],
  [t(null), t(null), t("1 col. sopa de azeite"), t(null), t(null)],
  vazia,
  [t("🥤 CREATINA"), t("Após almoço"), t("3-5g creatina monohidratada"), t(null), t("Com 200ml de água")],
  vazia,
  [t("💧 ÁGUA"), t("13h00 - 18h00"), t("1250ml"), t(null), t("Período mais ativo")],
  vazia,
  [t("Janta"), t("19h00 - 20h00"), t("100g de peixe branco"), t("~400 kcal"), t(null)],
  [t(null), t(null), t("2 col. sopa de feijão"), t(null), t(null)],
  [t(null), t(null), t("Legumes refogados"), t(null), t(null)],
  vazia,
  [t("💧 ÁGUA"), t("18h00 - 22h00"), t("1000ml"), t(null), t("Reduzir perto de dormir")],
  vazia,
  [b("TOTAL ESTIMADO"), t(null), t(null), b("1300 kcal"), t(null)],
  [b("HIDRATAÇÃO TOTAL"), t(null), b("3 LITROS"), t(null), t("Em 3 períodos")],
];

/* ══════════════════════════════════════════════════════════════════
   ABA: Macros (exemplo)
   ══════════════════════════════════════════════════════════════════ */

const MACROS: Celula[][] = [
  [
    b("Refeição"),
    b("Proteína (g)"),
    b("Carboidrato (g)"),
    b("Gordura (g)"),
    b("Calorias (kcal)"),
  ],
  [t("Café da Manhã"), t(25), t(35), t(15), t(400)],
  [t("Almoço"), t(35), t(45), t(15), t(500)],
  [t("Janta"), t(30), t(35), t(10), t(400)],
  [b("TOTAL DIÁRIO"), b("90"), b("115"), b("40"), b("1300")],
];

/* ══════════════════════════════════════════════════════════════════
   ABA: Substituicoes (exemplo)
   ══════════════════════════════════════════════════════════════════ */

const SUBSTITUICOES: Celula[][] = [
  [b("Refeição"), b("Categoria"), b("Alimento"), b("Porção"), b("Calorias (kcal)")],
  [t("Café da Manhã"), t("Proteína"), t("Ovos inteiros"), t("3 unidades (150g)"), t(210)],
  [t("Café da Manhã"), t("Proteína"), t("Iogurte grego light"), t("150g"), t(120)],
  [t("Café da Manhã"), t("Carboidrato"), t("Pão integral"), t("1 fatia (30g)"), t(75)],
  [t("Café da Manhã"), t("Carboidrato"), t("Aveia em flocos"), t("3 col. sopa (30g)"), t(110)],
  [t("Café da Manhã"), t("Fruta"), t("Banana"), t("1 unidade média"), t(90)],
  [t("Café da Manhã"), t("Fruta"), t("Maçã"), t("1 unidade média"), t(70)],
  [t("Almoço"), t("Proteína"), t("Peito de frango"), t("120g"), t(130)],
  [t("Almoço"), t("Proteína"), t("Peixe branco"), t("120g"), t(115)],
  [t("Almoço"), t("Carboidrato"), t("Arroz integral cozido"), t("100g"), t(110)],
  [t("Almoço"), t("Carboidrato"), t("Batata-doce cozida"), t("160g"), t(130)],
  [t("Almoço"), t("Gordura"), t("Azeite de oliva"), t("1 col. sopa (10g)"), t(90)],
  [t("Janta"), t("Proteína"), t("Peixe branco"), t("100g"), t(110)],
  [t("Janta"), t("Carboidrato"), t("Feijão cozido"), t("2 col. sopa (60g)"), t(60)],
  [t("Janta"), t("Vegetal"), t("Brócolis"), t("100g"), t(30)],
];

/* ══════════════════════════════════════════════════════════════════
   CSV — mesmo conteúdo, para quem não usa Excel
   ══════════════════════════════════════════════════════════════════ */

function paraCsv(linhas: Celula[][]): string {
  return linhas
    .map((linha) =>
      linha
        .map((c) => {
          const v = c.value === null || c.value === undefined ? "" : String(c.value);
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    )
    .join("\n");
}

/* ══════════════════════════════════════════════════════════════════ */

mkdirSync(DESTINO, { recursive: true });

const CAMINHO_XLSX = resolve(DESTINO, "template-macronaut.xlsx");

// A v4 devolve `{ toBuffer, toStream, toFile }` — chamar sem `.toFile()` gera
// o conteúdo e joga fora, sem erro nenhum.
await writeXlsxFile(
  [
    {
      sheet: "Instruções",
      data: INSTRUCOES,
      columns: [{ width: 22 }, { width: 62 }, { width: 44 }],
      showGridLines: false,
    },
    {
      sheet: "Plano",
      data: PLANO,
      columns: [{ width: 22 }, { width: 18 }, { width: 46 }, { width: 16 }, { width: 30 }],
    },
    {
      sheet: "Macros",
      data: MACROS,
      columns: [{ width: 22 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 16 }],
    },
    {
      sheet: "Substituicoes",
      data: SUBSTITUICOES,
      columns: [{ width: 22 }, { width: 16 }, { width: 28 }, { width: 22 }, { width: 16 }],
    },
  ],
).toFile(CAMINHO_XLSX);

// O BOM faz o Excel abrir o CSV em UTF-8; sem ele os acentos vêm quebrados.
const BOM = "﻿";
writeFileSync(resolve(DESTINO, "template-plano.csv"), BOM + paraCsv(PLANO) + "\n");
writeFileSync(resolve(DESTINO, "template-macros.csv"), BOM + paraCsv(MACROS) + "\n");
writeFileSync(
  resolve(DESTINO, "template-substituicoes.csv"),
  BOM + paraCsv(SUBSTITUICOES) + "\n",
);

/* ══════════════════════════════════════════════════════════════════
   VERIFICAÇÃO

   O template é lido de volta pelo MESMO parser que o app usa. Um
   template que o próprio app não consegue importar seria a pior
   forma possível de receber alguém que está começando.
   ══════════════════════════════════════════════════════════════════ */

const [{ default: readXlsxFile }, { montarRascunho, validarPlano }] = await Promise.all([
  import("read-excel-file/node"),
  import("../src/domain/plano-parse.ts"),
]);

const abasLidas = new Map(
  (await readXlsxFile(CAMINHO_XLSX, { trim: true })).map((a) => [a.sheet, a.data]),
);

const { rascunho, problemas } = montarRascunho({
  plano: abasLidas.get("Plano")!,
  macros: abasLidas.get("Macros") ?? null,
  substituicoes: abasLidas.get("Substituicoes") ?? null,
});
const { erros, avisos } = validarPlano(rascunho, problemas);

if (erros.length > 0) {
  console.error("O template gerado não passa no próprio importador:");
  for (const e of erros) console.error(`  ${e.onde}: ${e.mensagem}`);
  process.exit(1);
}

console.log("Template gerado em public/:");
console.log("  template-macronaut.xlsx (Instruções, Plano, Macros, Substituicoes)");
console.log("  template-plano.csv, template-macros.csv, template-substituicoes.csv");
console.log(
  `\nVerificado pelo importador: ${rascunho.blocos.filter((b) => b.tipo === "refeicao").length} refeições, ` +
    `${rascunho.blocos.filter((b) => b.tipo === "agua").length} períodos de água, ` +
    `${rascunho.macros.length} linhas de macro, ${rascunho.substituicoes.length} substituições.`,
);
if (avisos.length > 0) {
  console.log("\nAvisos (o import passa mesmo assim):");
  for (const a of avisos) console.log(`  ${a.onde}: ${a.mensagem}`);
}
