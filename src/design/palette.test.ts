import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  contrastRatio,
  extractBlock,
  inSrgbGamut,
  parseOklchTokens,
  toHex,
  type Oklch,
} from "./contrast";

// `new URL("../index.css", import.meta.url)` seria interceptado pela análise
// de import do Vite e reescrito para uma URL http do dev server, que
// `fileURLToPath` rejeita. Resolver em duas etapas evita esse padrão — mesmo
// motivo documentado em `test/helpers/test-db.ts`.
const AQUI = fileURLToPath(import.meta.url);
const CSS = readFileSync(resolve(dirname(AQUI), "../index.css"), "utf-8");

const TEMAS = {
  claro: parseOklchTokens(extractBlock(CSS, ":root")),
  escuro: parseOklchTokens(extractBlock(CSS, ".dark")),
};

/** WCAG 2.2 — texto normal 4.5:1, elemento gráfico e texto grande 3:1. */
const AA_TEXTO = 4.5;
const AA_GRAFICO = 3;

/** [nome do par, token de frente, token de fundo, mínimo] */
const PARES: [string, string, string, number][] = [
  ["texto no fundo da página", "foreground", "background", AA_TEXTO],
  ["texto no card", "foreground", "card", AA_TEXTO],
  ["texto secundário no fundo", "muted-foreground", "background", AA_TEXTO],
  ["texto secundário no card", "muted-foreground", "card", AA_TEXTO],
  ["texto secundário sobre muted", "muted-foreground", "muted", AA_TEXTO],
  ["texto do popover", "popover-foreground", "popover", AA_TEXTO],
  ["primary como texto no card", "primary", "card", AA_TEXTO],
  ["texto sobre botão primário", "primary-foreground", "primary", AA_TEXTO],
  ["texto sobre botão destrutivo", "destructive-foreground", "destructive", AA_TEXTO],
  ["texto do accent", "accent-foreground", "accent", AA_TEXTO],
  ["texto secundário sobre secondary", "secondary-foreground", "secondary", AA_TEXTO],
  ["barra de proteína no card", "macro-prot", "card", AA_GRAFICO],
  ["barra de carboidrato no card", "macro-carb", "card", AA_GRAFICO],
  ["barra de gordura no card", "macro-gord", "card", AA_GRAFICO],
  ["sucesso como texto no card", "success", "card", AA_TEXTO],
  ["aviso como texto no card", "warning", "card", AA_TEXTO],
  ["erro como texto no card", "destructive", "card", AA_TEXTO],
  ["anel de foco sobre o fundo", "ring", "background", AA_GRAFICO],
];

function token(tema: keyof typeof TEMAS, nome: string): Oklch {
  const c = TEMAS[tema].get(nome);
  if (!c) throw new Error(`token --${nome} não existe (ou não é oklch literal) em ${tema}`);
  return c;
}

describe.each(Object.keys(TEMAS) as (keyof typeof TEMAS)[])("paleta — tema %s", (tema) => {
  it("define todos os tokens usados nas verificações", () => {
    const faltando = [...new Set(PARES.flatMap(([, fg, bg]) => [fg, bg]))].filter(
      (t) => !TEMAS[tema].has(t),
    );
    expect(faltando).toEqual([]);
  });

  it.each(PARES)("%s tem contraste suficiente", (_nome, fg, bg, min) => {
    const a = token(tema, fg);
    const b = token(tema, bg);
    const ratio = contrastRatio(a, b);
    expect(
      ratio,
      `--${fg} (${toHex(a)}) sobre --${bg} (${toHex(b)}) = ${ratio.toFixed(2)}:1, mínimo ${min}:1`,
    ).toBeGreaterThanOrEqual(min);
  });

  it("mantém toda cor dentro do gamut sRGB", () => {
    // Fora do gamut o navegador corta o canal e a cor exibida deixa de ser a
    // escolhida — o contraste medido acima passa a valer para outra cor.
    const estouradas = [...TEMAS[tema].entries()]
      .filter(([, c]) => !inSrgbGamut(c))
      .map(([nome, c]) => `--${nome} → ${toHex(c)}`);
    expect(estouradas).toEqual([]);
  });

  it("distingue as três cores de macro entre si", () => {
    // Barras adjacentes com cores parecidas viram uma mancha só.
    const macros: [string, string][] = [
      ["macro-prot", "macro-carb"],
      ["macro-carb", "macro-gord"],
      ["macro-prot", "macro-gord"],
    ];
    for (const [a, b] of macros) {
      const dist = Math.abs(
        contrastRatio(token(tema, a), token(tema, "card")) -
          contrastRatio(token(tema, b), token(tema, "card")),
      );
      const hueGap = Math.abs(token(tema, a).h - token(tema, b).h);
      expect(
        dist > 0.5 || hueGap > 40,
        `--${a} e --${b} são indistinguíveis (Δcontraste ${dist.toFixed(2)}, Δmatiz ${hueGap})`,
      ).toBe(true);
    }
  });
});

describe("mistura de cor", () => {
  it("não mistura em oklch, que interpola matiz", () => {
    // `color-mix(in oklch, indigo 8%, white)` percorre o círculo de matiz entre
    // 274° e o matiz (indefinido, tratado como 0°) do branco, e o resultado sai
    // rosa. Em oklab a interpolação é retangular: o matiz não gira, e a mistura
    // é o indigo esmaecido que se pretendia.
    const emOklch = [...CSS.matchAll(/color-mix\(\s*in\s+oklch[^)]*\)/gi)].map((m) => m[0]);
    expect(emOklch).toEqual([]);
  });

  it("usa oklab nas misturas de tinta", () => {
    expect(CSS).toMatch(/--tint-primary:\s*color-mix\(\s*in\s+oklab/);
  });
});

describe("paleta — coerência entre temas", () => {
  it("define o mesmo conjunto de tokens nos dois temas", () => {
    // Um token que só existe no claro herda o valor do claro no escuro e
    // aparece com contraste errado.
    const soNoClaro = [...TEMAS.claro.keys()].filter((k) => !TEMAS.escuro.has(k));
    const soNoEscuro = [...TEMAS.escuro.keys()].filter((k) => !TEMAS.claro.has(k));
    expect({ soNoClaro, soNoEscuro }).toEqual({ soNoClaro: [], soNoEscuro: [] });
  });

  it("inverte a luminosidade de fundo e texto", () => {
    expect(token("claro", "background").l).toBeGreaterThan(token("claro", "foreground").l);
    expect(token("escuro", "background").l).toBeLessThan(token("escuro", "foreground").l);
  });
});
