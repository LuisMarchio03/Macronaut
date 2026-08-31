import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRO } from "./registro";

/**
 * O escopo é declarado em dois lugares, e eles não podem divergir.
 *
 * No servidor (`registro.ts`) ele decide se a função recebe o `user_id` do
 * token. No cliente (`api.ts`) ele decide quantos argumentos a assinatura
 * remota corta. Precisa ser declarado nos dois porque em TypeScript o NOME do
 * parâmetro não participa da compatibilidade de tipos: `(db, userId: number)` e
 * `(db, foodId: number)` são a mesma assinatura, e inferir escopo da forma
 * cortaria um argumento a mais em toda função global — calado, e só visível
 * como "argumento faltando" em tempo de execução.
 *
 * Duplicação declarada é aceitável quando um teste a mantém honesta. É este.
 */

const AQUI = fileURLToPath(import.meta.url);
const api = readFileSync(resolve(dirname(AQUI), "../../src/lib/api.ts"), "utf-8");

/** A união `Globais` do cliente, lida do arquivo. */
const uniao = /type Globais =\n([\s\S]*?);\n/.exec(api)?.[1] ?? "";
const padroes = [...uniao.matchAll(/\|\s*(?:`([^`]+)`|"([^"]+)")/g)].map((m) => m[1] ?? m[2]);

/** `foods.${string}` casa com o módulo inteiro; `"a.b"` casa exato. */
function ehGlobalNoCliente(nome: string): boolean {
  return padroes.some((p) =>
    p.endsWith("${string}") ? nome.startsWith(p.replace("${string}", "")) : p === nome,
  );
}

describe("o escopo do cliente e o do servidor concordam", () => {
  it("a união do cliente foi encontrada", () => {
    // Se o formato do arquivo mudar, este teste vira um falso verde silencioso.
    expect(padroes.length).toBeGreaterThan(0);
  });

  it("toda operação global no servidor é global no cliente", () => {
    const divergentes = Object.entries(REGISTRO)
      .filter(([nome, op]) => op.escopo === "global" && !ehGlobalNoCliente(nome))
      .map(([nome]) => nome);

    // Consequência: o cliente cortaria `userId` de uma função que não o tem, e
    // o primeiro argumento de verdade sumiria a caminho do servidor.
    expect(divergentes).toEqual([]);
  });

  it("toda operação global no cliente é global no servidor", () => {
    const divergentes = Object.entries(REGISTRO)
      .filter(([nome, op]) => op.escopo === "usuario" && ehGlobalNoCliente(nome))
      .map(([nome]) => nome);

    // Consequência oposta e pior: o servidor injetaria o `user_id` do token no
    // lugar do primeiro argumento da chamada.
    expect(divergentes).toEqual([]);
  });

  it("os módulos inteiramente globais são só os que não têm dono no schema", () => {
    // `foods` e `food_measures` não têm coluna de user_id — o catálogo é
    // compartilhado neste app. Qualquer outro módulo aparecendo aqui é sinal
    // de que alguém declarou pública uma linha que tem dono.
    const porModulo = new Set(
      padroes.filter((p) => p.endsWith("${string}")).map((p) => p.replace(".${string}", "")),
    );
    expect([...porModulo].sort()).toEqual(["food-measures", "foods"]);
  });
});
