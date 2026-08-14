/**
 * Conversão oklch → sRGB e contraste WCAG, sem dependência.
 *
 * Existe para que a afirmação "a paleta passa em AA" seja verificada pela
 * suíte (`palette.test.ts`) em vez de acreditada. Matemática do Oklab
 * conforme a especificação de Björn Ottosson.
 */

export type Oklch = { l: number; c: number; h: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** oklch → sRGB linear, SEM clamp (para detectar estouro de gamut). */
export function oklchToLinearRgb({ l: L, c: C, h: H }: Oklch): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;

  return [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ];
}

/** A cor cabe no gamut sRGB? Fora dele o navegador corta e a cor exibida
 *  deixa de ser a cor escolhida — inclusive o contraste calculado. */
export function inSrgbGamut(color: Oklch, tolerance = 0.001): boolean {
  return oklchToLinearRgb(color).every((v) => v >= -tolerance && v <= 1 + tolerance);
}

/** Luminância relativa WCAG 2.x. */
export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearRgb(color);
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

/** Razão de contraste WCAG entre duas cores, de 1:1 a 21:1. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function toHex(color: Oklch): string {
  const encode = (v: number) => {
    const c = clamp01(v);
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(s * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return "#" + oklchToLinearRgb(color).map(encode).join("");
}

/**
 * Extrai `--token: oklch(L C H)` de um bloco CSS. Ignora tokens que não são
 * oklch literal (color-mix, var(), etc.) — esses derivam de outros e não têm
 * um valor próprio a verificar.
 */
export function parseOklchTokens(css: string): Map<string, Oklch> {
  const out = new Map<string, Oklch>();
  const re = /--([a-z0-9-]+)\s*:\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/gi;
  for (const m of css.matchAll(re)) {
    out.set(m[1], { l: Number(m[2]), c: Number(m[3]), h: Number(m[4]) });
  }
  return out;
}

/** Recorta o corpo de um seletor de nível superior (`:root`, `.dark`). */
export function extractBlock(css: string, selector: string): string {
  const start = css.indexOf(selector + " {");
  if (start === -1) throw new Error(`seletor não encontrado no CSS: ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`bloco não fechado: ${selector}`);
}
