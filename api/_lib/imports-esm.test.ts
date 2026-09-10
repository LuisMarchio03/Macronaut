import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Nenhum módulo do servidor pode importar sem escrever `.js` no fim.
 *
 * O `tsconfig` usa `moduleResolution: "bundler"`, e o Vite resolve `./treino`,
 * `./treino.ts` e `./treino.js` igual — então o erro passa batido no `tsc`, no
 * `vite build` e na suíte. A Vercel NÃO é um bundler: ela transpila arquivo a
 * arquivo, `sessao.ts` vira `sessao.js` e o especificador continua escrito do
 * jeito que estava. Aí o Node, em ESM de verdade, procura `/var/task/src/
 * domain/prescricao` e não acha — a função inteira morre no import, antes do
 * handler, e a Vercel devolve `FUNCTION_INVOCATION_FAILED` sem uma linha de log
 * nossa.
 *
 * Foi o que tirou `/api/rpc` — logo, o app todo depois do login — do ar.
 * `.js` no especificador é o que o Node ESM exige; é o que o `api/` já fazia.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** `import ... from "x"`, `export ... from "x"` — a cláusula e o especificador. */
const IMPORTA = /^\s*(?:import|export)\b([\s\S]*?)from\s*["']([^"']+)["']/gm;

/** O arquivo que o especificador aponta, resolvido como o Vite resolveria. */
function arquivoDe(origem: string, spec: string): string | null {
  const alvo = resolve(dirname(origem), spec);
  const tentativas = [
    alvo,
    alvo.endsWith(".js") ? `${alvo.slice(0, -3)}.ts` : `${alvo}.ts`,
    join(alvo, "index.ts"),
  ];
  return tentativas.find((c) => statSync(c, { throwIfNoEntry: false })?.isFile()) ?? null;
}

/** As rotas: todo `.ts` em `api/` que não é teste. */
function rotas(): string[] {
  return readdirSync(join(RAIZ, "api"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(RAIZ, "api", f));
}

/** Percorre o grafo a partir das rotas e devolve os especificadores sem `.js`. */
function especificadoresSemJs(): string[] {
  const vistos = new Set<string>();
  const fila = rotas();
  const problemas: string[] = [];

  while (fila.length > 0) {
    const arquivo = fila.pop()!;
    if (vistos.has(arquivo)) continue;
    vistos.add(arquivo);

    const texto = readFileSync(arquivo, "utf-8");
    for (const [, , spec] of texto.matchAll(IMPORTA)) {
      if (!spec.startsWith(".")) continue;
      if (!spec.endsWith(".js")) {
        problemas.push(`${relative(RAIZ, arquivo)} → ${spec}`);
      }
      const alvo = arquivoDe(arquivo, spec);
      if (alvo) fila.push(alvo);
    }
  }
  return problemas.sort();
}

describe("os imports do servidor resolvem em ESM de verdade", () => {
  it("o grafo tem tamanho de gente — se encolher, o teste virou verde falso", () => {
    expect(rotas().length).toBeGreaterThanOrEqual(5);
  });

  it("todo import relativo termina em .js", () => {
    expect(especificadoresSemJs()).toEqual([]);
  });
});
