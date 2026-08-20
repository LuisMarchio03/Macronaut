/**
 * Apaga os dados de uso do app, preservando o login e os catálogos.
 *
 * Existe porque "recomeçar" não é o mesmo que "recriar o banco": a TACO, as
 * medidas da POF e os 170 exercícios do catálogo levam minutos para semear e
 * não são do usuário — são conteúdo. O que sai daqui é o que a pessoa
 * registrou: diário, plano, treinos, pesagens, água, conversas com a IA.
 *
 * DRY-RUN POR PADRÃO. Sem `--confirmar` ele só conta e mostra; nada é apagado.
 *
 *   npm run db:limpar
 *   npm run db:limpar -- --confirmar
 *
 * Para outro banco que não o do `.env.local`:
 *
 *   DB_URL=libsql://… DB_TOKEN=… node --experimental-strip-types scripts/limpar-dados.ts
 *
 * Opções:
 *   --confirmar        executa de verdade (sem isso, só relatório)
 *   --email <e-mail>   restringe a um usuário (padrão: todos)
 *   --sem-refeicoes    não recria as refeições padrão depois de limpar
 *
 * A regra do que é dado de uso mora em `scripts/lib/limpar-dados.ts`, onde é
 * testada contra um banco de verdade.
 */
import { createClient } from "@libsql/client";
import {
  executarLimpeza,
  jaLimpo,
  planejarLimpeza,
  type Opcoes,
} from "./lib/limpar-dados.ts";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const tem = (flag: string) => process.argv.includes(flag);

const confirmar = tem("--confirmar");
const opcoes: Opcoes = {
  email: arg("--email")?.trim().toLowerCase(),
  recriarRefeicoes: !tem("--sem-refeicoes"),
};

const url = process.env.DB_URL;
if (!url) throw new Error("DB_URL não definida (use --env-file=.env.local, ou exporte a variável)");
const db = createClient({ url, authToken: process.env.DB_TOKEN });

const plano = await planejarLimpeza(db, opcoes);

console.log(`Banco: ${url}`);
console.log(
  `Usuários preservados (login intacto): ${plano.usuarios
    .map((u) => `${u.email} (id ${u.id})`)
    .join(", ")}\n`,
);
if (!plano.escopoGlobal) {
  console.log("Modo --email: `foods` e `food_measures` ficam de fora (não têm dono).\n");
}

// Um comando destrutivo que pula tabela em silêncio diria "pronto, limpo"
// tendo deixado dado para trás — é o mesmo defeito que a tela de import tinha.
if (plano.tabelasAusentes.length > 0) {
  console.log(
    `ATENÇÃO: este banco não tem ${plano.tabelasAusentes.length} tabela(s) do schema atual:`,
  );
  console.log(`  ${plano.tabelasAusentes.join(", ")}`);
  console.log("O schema está atrasado. Rode `npm run db:setup` apontando para ele.\n");
}

if (jaLimpo(plano)) {
  console.log("Nada a apagar — o banco já está limpo.");
  db.close();
  process.exit(0);
}

const largura = Math.max(...plano.pendentes.map((p) => p.tabela.length));
const linha = (tabela: string, n: number | string, sufixo = "") =>
  `  ${tabela.padEnd(largura)}  ${String(n).padStart(6)}${sufixo}`;

for (const p of plano.pendentes) console.log(linha(p.tabela, p.n));
console.log(`  ${"".padEnd(largura, "─")}  ${"─".repeat(6)}`);
console.log(linha("total", plano.total) + "\n");

if (plano.recriadas > 0) {
  console.log(
    `As ${plano.recriadas} refeições padrão saem e voltam (use --sem-refeicoes para não recriar).\n`,
  );
}

if (!confirmar) {
  console.log("DRY-RUN — nada foi apagado.");
  console.log("Para executar, repita o comando com --confirmar.");
  db.close();
  process.exit(0);
}

for (const p of await executarLimpeza(db, opcoes)) {
  console.log(linha(p.tabela, p.n, " apagados"));
}

if (opcoes.recriarRefeicoes) {
  console.log(`\nRefeições padrão recriadas para ${plano.usuarios.length} usuário(s).`);
}

console.log("\nPronto. Login preservado; TACO, medidas da POF e catálogo de exercícios intactos.");
db.close();
