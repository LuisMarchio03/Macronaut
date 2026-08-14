import type {
  Abas,
  CategoriaItem,
  Celula,
  Grade,
  Problema,
  RascunhoBloco,
  RascunhoMacro,
  RascunhoMeta,
  RascunhoPlano,
  RascunhoSwap,
  ResultadoValidacao,
  TipoBloco,
} from "./plano-types";

/* ══════════════════════════════════════════════════════════════════
   NORMALIZAÇÃO DE CÉLULA
   ══════════════════════════════════════════════════════════════════ */

/**
 * Exportadores de planilha preenchem colunas sem cabeçalho com `Unnamed: 1`,
 * `Unnamed: 2`… e o texto vai gravado no arquivo. Sem tratar isso, a primeira
 * linha da planilha do usuário viraria quatro colunas de lixo.
 */
const PLACEHOLDER = /^unnamed:?\s*\d+$/i;

export function texto(c: Celula): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString();
  const s = String(c).trim();
  return PLACEHOLDER.test(s) ? "" : s;
}

/** Minúsculas, sem acento — para comparar rótulo escrito por gente. */
export function chave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Remove emoji e símbolos decorativos do começo do nome do bloco. */
export function limparNome(s: string): string {
  return s
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

const vazia = (c: Celula) => texto(c) === "";
const linhaVazia = (linha: Celula[]) => linha.every(vazia);

/* ══════════════════════════════════════════════════════════════════
   HORÁRIO
   ══════════════════════════════════════════════════════════════════ */

/**
 * Separadores de intervalo: travessão/hífen colados ou não, e as palavras
 * "às", "até", "a" cercadas de espaço.
 *
 * As palavras não podem usar `\b`: em JavaScript a fronteira de palavra é
 * ASCII, e `à` não conta como caractere de palavra — `\bàs\b` nunca casaria
 * com "12h00 às 13h00".
 */
const SEPARADORES = /\s*[—–-]\s*|\s+(?:às|as|até|ate|a)\s+/i;

/** "das 7h" → "7h". Prefixo comum em planilha escrita por gente. */
const PREFIXO_HORA = /^(?:das|de|a partir das?|entre)\s+/i;

/** "7h00" | "7h" | "07:00" | "7" → "07:00". Devolve null se não for hora. */
export function normalizarHora(s: string): string | null {
  const m = /^(\d{1,2})\s*(?:[h:]\s*(\d{1,2}))?\s*(?:h|min)?$/i.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export interface Horario {
  inicio: string | null;
  fim: string | null;
  /** Texto original quando não há hora reconhecível ("Após almoço"). */
  ancora: string | null;
}

export function parseHorario(bruto: string): Horario {
  const s = bruto.trim();
  if (!s) return { inicio: null, fim: null, ancora: null };

  const partes = s
    .split(SEPARADORES)
    .map((p) => p.replace(PREFIXO_HORA, "").trim())
    .filter(Boolean);
  const inicio = normalizarHora(partes[0] ?? "");
  const fim = partes.length > 1 ? normalizarHora(partes[1]) : null;

  // "Após almoço", "Ao acordar", "Pré-treino": o plano ancora a um evento em
  // vez de a um relógio. Guardar o texto preserva a instrução; inventar um
  // horário a perderia.
  if (inicio === null) return { inicio: null, fim: null, ancora: s };

  return { inicio, fim, ancora: null };
}

/* ══════════════════════════════════════════════════════════════════
   CALORIAS
   ══════════════════════════════════════════════════════════════════ */

export interface Faixa {
  min: number;
  max: number;
}

/** "~400 kcal" → 400/400. "1600-1800 kcal" → 1600/1800. */
export function parseKcal(bruto: string): Faixa | null {
  const nums = [...bruto.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) =>
    Number(m[0].replace(",", ".")),
  );
  if (nums.length === 0) return null;
  const min = nums[0];
  const max = nums.length > 1 ? nums[1] : nums[0];
  return min <= max ? { min, max } : { min: max, max: min };
}

/** O valor único que representa a faixa: o ponto médio. */
export function kcalRepresentativa(f: Faixa): number {
  return Math.round((f.min + f.max) / 2);
}

/* ══════════════════════════════════════════════════════════════════
   VOLUME DE ÁGUA
   ══════════════════════════════════════════════════════════════════ */

/**
 * "750ml (3-4 copos de 200ml)" → 750. "1,5 litros" → 1500. "3 LITROS" → 3000.
 *
 * Vale a PRIMEIRA quantidade com unidade: o que vem entre parênteses detalha
 * como fracionar, não é um segundo alvo.
 */
export function parseMl(bruto: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(ml|mls|l\b|lt|litros?)/i.exec(bruto);
  if (!m) return null;
  const valor = Number(m[1].replace(",", "."));
  const unidade = m[2].toLowerCase();
  const emLitros = unidade.startsWith("l");
  return Math.round(emLitros ? valor * 1000 : valor);
}

/** "3 unidades (150g)" → 150. "120g" → 120. */
export function parseGramas(bruto: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*g\b/i.exec(bruto);
  if (!m) return null;
  return Number(m[1].replace(",", "."));
}

/* ══════════════════════════════════════════════════════════════════
   CLASSIFICAÇÃO DE BLOCO
   ══════════════════════════════════════════════════════════════════ */

const PADRAO_AGUA = /(^|\s)(agua|hidratacao)(\s|$)/;
const PADRAO_SUPLEMENTO =
  /(creatina|suplemento|whey|cafeina|omega|vitamina|colageno|glutamina|multivitaminico|bcaa)/;

/** Linhas de fechamento da planilha — viram validação, não bloco. */
const PADRAO_RESUMO = /^(total|hidratacao total|resumo|soma)\b/;

export function ehLinhaResumo(nome: string): boolean {
  return PADRAO_RESUMO.test(chave(limparNome(nome)));
}

export function tipoDoBloco(nomeBruto: string): TipoBloco {
  const bruto = nomeBruto;
  const k = chave(limparNome(nomeBruto));

  // O emoji é o sinal mais confiável quando existe: quem escreve a planilha
  // marca os blocos de água e suplemento antes de nomeá-los.
  if (bruto.includes("💧") || bruto.includes("🚰") || PADRAO_AGUA.test(k)) return "agua";
  if (bruto.includes("🥤") || bruto.includes("💊") || PADRAO_SUPLEMENTO.test(k)) {
    return "suplemento";
  }
  return "refeicao";
}

/* ══════════════════════════════════════════════════════════════════
   CATEGORIA DO ITEM

   Serve para casar o item com as substituições da mesma categoria. Sem
   match o item aparece normal, só não oferece troca — errar a categoria
   seria pior do que não ter uma.
   ══════════════════════════════════════════════════════════════════ */

const CATEGORIAS: [CategoriaItem, RegExp][] = [
  [
    "proteina",
    /(ovos?|clara|frango|peito|peixe|tilapia|salmao|atum|carne|patinho|alcatra|iogurte|queijo|cottage|ricota|whey|proteina|camarao|sardinha|peru|file)/,
  ],
  [
    "carboidrato",
    /(arroz|batata|pao|paes|aveia|tapioca|macarrao|massa|cuscuz|feijao|lentilha|grao-de-bico|grao de bico|quinoa|mandioca|inhame|granola|torrada|biscoito|milho)/,
  ],
  [
    "fruta",
    /(fruta|banana|maca|mamao|abacaxi|melancia|manga|laranja|morango|uva|pera|kiwi|abacate|melao)/,
  ],
  [
    "gordura",
    /(azeite|oleo|pasta de amendoim|amendoim|castanha|noz|nozes|amendoa|semente|chia|linhaca|gergelim|manteiga|abacate)/,
  ],
  [
    "vegetal",
    /(salada|alface|brocolis|couve|espinafre|abobrinha|chuchu|cenoura|tomate|pepino|vagem|berinjela|legume|vegetais|verdura|rucula|repolho)/,
  ],
];

export function categoriaDoTexto(texto: string): CategoriaItem | null {
  const k = chave(texto);
  for (const [cat, re] of CATEGORIAS) {
    if (re.test(k)) return cat;
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════
   LOCALIZAÇÃO DO CABEÇALHO
   ══════════════════════════════════════════════════════════════════ */

export type Campo = "refeicao" | "horario" | "alimentos" | "calorias" | "observacoes";

const SINONIMOS: Record<Campo, string[]> = {
  refeicao: ["refeicao", "refeicoes", "momento", "bloco"],
  horario: ["horario", "hora", "horarios"],
  alimentos: ["alimentos", "alimento", "itens", "o que comer", "descricao"],
  calorias: ["calorias", "kcal", "caloria"],
  observacoes: ["observacoes", "observacao", "obs", "notas", "nota"],
};

export interface Cabecalho {
  linha: number;
  colunas: Partial<Record<Campo, number>>;
}

/**
 * Acha a linha de cabeçalho pelo NOME das colunas, não pela posição. Assim
 * trocar a ordem das colunas ou acrescentar uma não quebra a importação.
 */
export function acharCabecalho(grade: Grade): Cabecalho | null {
  for (let i = 0; i < grade.length; i++) {
    const colunas: Partial<Record<Campo, number>> = {};
    grade[i].forEach((celula, j) => {
      const k = chave(texto(celula));
      if (!k) return;
      for (const [campo, nomes] of Object.entries(SINONIMOS) as [Campo, string[]][]) {
        if (colunas[campo] === undefined && nomes.includes(k)) colunas[campo] = j;
      }
    });
    // "refeição" + "alimentos" é o mínimo que identifica a tabela do plano.
    if (colunas.refeicao !== undefined && colunas.alimentos !== undefined) {
      return { linha: i, colunas };
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════
   CABEÇALHO DE METAS (as linhas antes da tabela)
   ══════════════════════════════════════════════════════════════════ */

function parseMetas(grade: Grade, ateLinha: number): RascunhoMeta {
  const meta: RascunhoMeta = {
    nome: "",
    kcal_min: null,
    kcal_max: null,
    prot_alvo_g: null,
    agua_ml_alvo: null,
    total_kcal_declarado: null,
    agua_total_declarada_ml: null,
  };

  for (let i = 0; i < ateLinha; i++) {
    const linha = grade[i].map(texto).filter(Boolean).join(" ");
    if (!linha) continue;

    const k = chave(linha);
    const depoisDosDoisPontos = linha.includes(":") ? linha.slice(linha.indexOf(":") + 1) : linha;

    if (/meta\s+calorica/.test(k)) {
      const f = parseKcal(depoisDosDoisPontos);
      if (f) {
        meta.kcal_min = f.min;
        meta.kcal_max = f.max;
      }
      continue;
    }
    if (/meta\s+proteina/.test(k)) {
      const g = parseGramas(depoisDosDoisPontos) ?? parseKcal(depoisDosDoisPontos)?.min ?? null;
      meta.prot_alvo_g = g;
      continue;
    }
    if (/meta\s+agua/.test(k)) {
      meta.agua_ml_alvo = parseMl(depoisDosDoisPontos);
      continue;
    }
    // A primeira linha de texto que não é uma meta é o título do plano.
    if (!meta.nome) meta.nome = linha;
  }

  if (!meta.nome) meta.nome = "Plano importado";
  return meta;
}

/* ══════════════════════════════════════════════════════════════════
   ABA "PLANO"
   ══════════════════════════════════════════════════════════════════ */

export interface PlanoParseado {
  meta: RascunhoMeta;
  blocos: RascunhoBloco[];
  problemas: Problema[];
}

export function parsePlano(grade: Grade): PlanoParseado {
  const problemas: Problema[] = [];
  const cab = acharCabecalho(grade);

  if (!cab) {
    return {
      meta: parseMetas(grade, grade.length),
      blocos: [],
      problemas: [
        {
          nivel: "erro",
          onde: "aba Plano",
          mensagem:
            "Não achei a linha de cabeçalho. Ela precisa ter pelo menos as colunas REFEIÇÃO e ALIMENTOS.",
        },
      ],
    };
  }

  const meta = parseMetas(grade, cab.linha);
  const col = cab.colunas;
  const em = (linha: Celula[], campo: Campo) =>
    col[campo] === undefined ? "" : texto(linha[col[campo]!]);

  const blocos: RascunhoBloco[] = [];

  for (let i = cab.linha + 1; i < grade.length; i++) {
    const linha = grade[i];
    if (linhaVazia(linha)) continue;

    const nomeBruto = em(linha, "refeicao");
    const alimentos = em(linha, "alimentos");
    const numeroLinha = i + 1;

    /* Continuação: REFEIÇÃO vazia significa "mais um item do bloco acima". É
       assim que a planilha representa os vários alimentos de uma refeição. */
    if (!nomeBruto) {
      if (!alimentos) continue;
      const atual = blocos.at(-1);
      if (!atual) {
        problemas.push({
          nivel: "aviso",
          onde: `linha ${numeroLinha}`,
          mensagem: `"${alimentos}" aparece antes de qualquer refeição e foi ignorado.`,
        });
        continue;
      }
      atual.itens.push({ texto: alimentos, categoria: categoriaDoTexto(alimentos) });
      continue;
    }

    /* Linha de fechamento: vira validação, não bloco. */
    if (ehLinhaResumo(nomeBruto)) {
      const k = chave(limparNome(nomeBruto));
      if (k.startsWith("hidratacao")) {
        meta.agua_total_declarada_ml = parseMl(alimentos) ?? parseMl(em(linha, "calorias"));
      } else {
        meta.total_kcal_declarado =
          parseKcal(em(linha, "calorias")) ?? parseKcal(alimentos) ?? null;
      }
      continue;
    }

    /* Bloco novo. */
    const tipo = tipoDoBloco(nomeBruto);
    const horarioBruto = em(linha, "horario");
    const { inicio, fim, ancora } = parseHorario(horarioBruto);
    const kcal = parseKcal(em(linha, "calorias"));

    if (horarioBruto && ancora && !/[a-z]/i.test(horarioBruto)) {
      problemas.push({
        nivel: "aviso",
        onde: `linha ${numeroLinha}`,
        mensagem: `Não entendi o horário "${horarioBruto}". O bloco ficou sem hora definida.`,
      });
    }

    const ml = tipo === "agua" ? (parseMl(alimentos) ?? parseMl(em(linha, "observacoes"))) : null;
    if (tipo === "agua" && ml === null) {
      problemas.push({
        nivel: "aviso",
        onde: `linha ${numeroLinha}`,
        mensagem: `O bloco de água "${limparNome(nomeBruto)}" não diz quantos ml. Vai aparecer sem meta.`,
      });
    }

    blocos.push({
      tipo,
      nome: limparNome(nomeBruto),
      hora_inicio: inicio,
      hora_fim: fim,
      ancora,
      kcal_alvo: kcal ? kcalRepresentativa(kcal) : null,
      ml_alvo: ml,
      observacao: em(linha, "observacoes") || null,
      itens: alimentos ? [{ texto: alimentos, categoria: categoriaDoTexto(alimentos) }] : [],
    });
  }

  return { meta, blocos, problemas };
}

/* ══════════════════════════════════════════════════════════════════
   ABA "MACROS"
   ══════════════════════════════════════════════════════════════════ */

function numero(c: Celula): number | null {
  const s = texto(c).replace(",", ".");
  if (!s) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(s);
  return m ? Number(m[0]) : null;
}

export function parseMacros(grade: Grade | null): {
  macros: RascunhoMacro[];
  problemas: Problema[];
} {
  if (!grade || grade.length === 0) {
    return {
      macros: [],
      problemas: [
        {
          nivel: "aviso",
          onde: "aba Macros",
          mensagem: "Aba ausente. O plano fica sem a divisão de macros por refeição.",
        },
      ],
    };
  }

  const problemas: Problema[] = [];
  const macros: RascunhoMacro[] = [];

  // Cabeçalho por nome: "Proteína (g)", "Carboidrato (g)", "Gordura (g)", "Calorias (kcal)".
  const idx = { nome: 0, prot: 1, carb: 2, gord: 3, kcal: 4 };
  const cabecalho = grade[0].map((c) => chave(texto(c)));
  cabecalho.forEach((k, j) => {
    if (/proteina/.test(k)) idx.prot = j;
    else if (/carboidrato|carbo/.test(k)) idx.carb = j;
    else if (/gordura/.test(k)) idx.gord = j;
    else if (/caloria|kcal/.test(k)) idx.kcal = j;
    else if (/refeicao|bloco/.test(k)) idx.nome = j;
  });

  for (let i = 1; i < grade.length; i++) {
    const linha = grade[i];
    if (linhaVazia(linha)) continue;

    const nome = limparNome(texto(linha[idx.nome]));
    if (!nome) continue;
    // "TOTAL DIÁRIO" é a soma das linhas acima, não uma refeição.
    if (ehLinhaResumo(nome)) continue;

    const prot = numero(linha[idx.prot]);
    const carb = numero(linha[idx.carb]);
    const gord = numero(linha[idx.gord]);
    const kcal = numero(linha[idx.kcal]);

    if (prot === null || carb === null || gord === null || kcal === null) {
      problemas.push({
        nivel: "aviso",
        onde: `aba Macros, linha ${i + 1}`,
        mensagem: `"${nome}" tem valores faltando e foi ignorada.`,
      });
      continue;
    }

    macros.push({ block_nome: nome, prot_g: prot, carb_g: carb, gord_g: gord, kcal });
  }

  return { macros, problemas };
}

/* ══════════════════════════════════════════════════════════════════
   ABA "SUBSTITUICOES"
   ══════════════════════════════════════════════════════════════════ */

export function parseSubstituicoes(grade: Grade | null): {
  substituicoes: RascunhoSwap[];
  problemas: Problema[];
} {
  if (!grade || grade.length === 0) {
    return {
      substituicoes: [],
      problemas: [
        {
          nivel: "aviso",
          onde: "aba Substituicoes",
          mensagem: "Aba ausente. O app não vai poder sugerir trocas de alimento.",
        },
      ],
    };
  }

  const problemas: Problema[] = [];
  const substituicoes: RascunhoSwap[] = [];

  const idx = { nome: 0, categoria: 1, alimento: 2, porcao: 3, kcal: 4 };
  grade[0].forEach((c, j) => {
    const k = chave(texto(c));
    if (/refeicao|bloco/.test(k)) idx.nome = j;
    else if (/categoria|grupo/.test(k)) idx.categoria = j;
    else if (/alimento|opcao/.test(k)) idx.alimento = j;
    else if (/porcao|quantidade|medida/.test(k)) idx.porcao = j;
    else if (/caloria|kcal/.test(k)) idx.kcal = j;
  });

  for (let i = 1; i < grade.length; i++) {
    const linha = grade[i];
    if (linhaVazia(linha)) continue;

    const nome = limparNome(texto(linha[idx.nome]));
    const alimento = texto(linha[idx.alimento]);
    if (!nome || !alimento) continue;

    const kcal = numero(linha[idx.kcal]);
    if (kcal === null) {
      problemas.push({
        nivel: "aviso",
        onde: `aba Substituicoes, linha ${i + 1}`,
        mensagem: `"${alimento}" está sem calorias e foi ignorado.`,
      });
      continue;
    }

    const porcao = texto(linha[idx.porcao]);
    substituicoes.push({
      block_nome: nome,
      categoria: chave(texto(linha[idx.categoria])) || "outros",
      alimento,
      porcao,
      qty_g: parseGramas(porcao),
      kcal,
    });
  }

  return { substituicoes, problemas };
}

/* ══════════════════════════════════════════════════════════════════
   MONTAGEM E VALIDAÇÃO
   ══════════════════════════════════════════════════════════════════ */

export function montarRascunho(abas: Abas): {
  rascunho: RascunhoPlano;
  problemas: Problema[];
} {
  const plano = parsePlano(abas.plano);
  const macros = parseMacros(abas.macros);
  const subs = parseSubstituicoes(abas.substituicoes);

  return {
    rascunho: {
      meta: plano.meta,
      blocos: plano.blocos,
      macros: macros.macros,
      substituicoes: subs.substituicoes,
    },
    problemas: [...plano.problemas, ...macros.problemas, ...subs.problemas],
  };
}

/** Divergência tolerada entre o total declarado e a soma das refeições. */
const TOLERANCIA_TOTAL = 0.15;

export function validarPlano(
  rascunho: RascunhoPlano,
  problemasDoParser: Problema[] = [],
): ResultadoValidacao {
  const problemas: Problema[] = [...problemasDoParser];
  const refeicoes = rascunho.blocos.filter((b) => b.tipo === "refeicao");

  if (refeicoes.length === 0) {
    problemas.push({
      nivel: "erro",
      onde: "aba Plano",
      mensagem: "Nenhuma refeição encontrada. Um plano precisa de pelo menos uma.",
    });
  }

  for (const b of refeicoes) {
    if (b.itens.length === 0) {
      problemas.push({
        nivel: "erro",
        onde: `refeição "${b.nome}"`,
        mensagem: "Está sem nenhum alimento na coluna ALIMENTOS.",
      });
    }
  }

  /* Nome de REFEIÇÃO duplicado quebra o casamento com Macros e Substituicoes,
     que referenciam o bloco pelo nome. Água e suplemento se repetem de
     propósito — um plano normal tem vários períodos chamados "ÁGUA", separados
     pelo horário — então a regra não se aplica a eles. */
  const vistos = new Set<string>();
  for (const b of refeicoes) {
    const k = chave(b.nome);
    if (vistos.has(k)) {
      problemas.push({
        nivel: "erro",
        onde: `refeição "${b.nome}"`,
        mensagem:
          "O nome aparece duas vezes. Como as abas Macros e Substituicoes casam pelo nome, ele precisa ser único.",
      });
    }
    vistos.add(k);
  }

  const somaKcal = refeicoes.reduce((s, b) => s + (b.kcal_alvo ?? 0), 0);
  const declarado = rascunho.meta.total_kcal_declarado;
  if (declarado && somaKcal > 0) {
    const alvo = kcalRepresentativa(declarado);
    const desvio = Math.abs(somaKcal - alvo) / alvo;
    if (desvio > TOLERANCIA_TOTAL) {
      problemas.push({
        nivel: "aviso",
        onde: "total do plano",
        mensagem: `A planilha declara ${alvo} kcal no total, mas as refeições somam ${somaKcal} kcal.`,
      });
    }
  }

  const somaAgua = rascunho.blocos
    .filter((b) => b.tipo === "agua")
    .reduce((s, b) => s + (b.ml_alvo ?? 0), 0);
  const aguaAlvo = rascunho.meta.agua_ml_alvo ?? rascunho.meta.agua_total_declarada_ml;
  if (aguaAlvo && somaAgua > 0 && Math.abs(somaAgua - aguaAlvo) / aguaAlvo > TOLERANCIA_TOTAL) {
    problemas.push({
      nivel: "aviso",
      onde: "hidratação",
      mensagem: `A meta de água é ${aguaAlvo} ml, mas os períodos somam ${somaAgua} ml.`,
    });
  }

  // Nome em Macros/Substituicoes que não casa com nenhum bloco: a linha existe
  // mas nunca vai ser mostrada, e é quase sempre um erro de digitação.
  const nomesDeBloco = new Set(rascunho.blocos.map((b) => chave(b.nome)));
  const orfaos = (nomes: string[], aba: string) => {
    for (const n of new Set(nomes.map(chave))) {
      if (!nomesDeBloco.has(n)) {
        problemas.push({
          nivel: "aviso",
          onde: `aba ${aba}`,
          mensagem: `"${n}" não corresponde a nenhuma refeição do plano.`,
        });
      }
    }
  };
  orfaos(
    rascunho.macros.map((m) => m.block_nome),
    "Macros",
  );
  orfaos(
    rascunho.substituicoes.map((s) => s.block_nome),
    "Substituicoes",
  );

  return {
    erros: problemas.filter((p) => p.nivel === "erro"),
    avisos: problemas.filter((p) => p.nivel === "aviso"),
  };
}
