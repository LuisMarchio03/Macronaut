import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acharCabecalho,
  categoriaDoTexto,
  chave,
  ehLinhaResumo,
  limparNome,
  montarRascunho,
  normalizarHora,
  parseGramas,
  parseHorario,
  parseKcal,
  parseMacros,
  parseMl,
  parsePlano,
  parseSubstituicoes,
  texto,
  tipoDoBloco,
  validarPlano,
} from "./plano-parse";
import type { Grade } from "./plano-types";

// Ver `test/helpers/test-db.ts`: `new URL(..., import.meta.url)` é reescrito
// pela análise de import do Vite para uma URL http.
const AQUI = fileURLToPath(import.meta.url);
const REAL = JSON.parse(
  readFileSync(resolve(dirname(AQUI), "../../test/fixtures/plano-cutting-real.json"), "utf-8"),
) as Record<string, Grade>;

const abasReais = () => ({
  plano: REAL["Plano"],
  macros: REAL["Macros"],
  substituicoes: REAL["Substituicoes"],
});

/* ══════════════════════════════════════════════════════════════════
   PRIMITIVAS
   ══════════════════════════════════════════════════════════════════ */

describe("texto", () => {
  it("descarta o placeholder que exportadores gravam em coluna sem título", () => {
    // Está literalmente no arquivo do usuário, na primeira linha.
    expect(texto("Unnamed: 1")).toBe("");
    expect(texto("Unnamed: 42")).toBe("");
  });

  it("preserva texto que apenas contém a palavra", () => {
    expect(texto("Unnamed hero")).toBe("Unnamed hero");
  });

  it("normaliza vazios e apara espaço", () => {
    expect(texto(null)).toBe("");
    expect(texto("  Almoço  ")).toBe("Almoço");
    expect(texto(400)).toBe("400");
  });
});

describe("chave", () => {
  it("tira acento e caixa", () => {
    expect(chave("REFEIÇÃO")).toBe("refeicao");
    expect(chave("Observações")).toBe("observacoes");
    expect(chave("Café da Manhã")).toBe("cafe da manha");
  });
});

describe("limparNome", () => {
  it("remove emoji e símbolo do começo", () => {
    expect(limparNome("💧 ÁGUA")).toBe("ÁGUA");
    expect(limparNome("🥤 CREATINA")).toBe("CREATINA");
    expect(limparNome("Café da Manhã")).toBe("Café da Manhã");
  });

  it("não come letra acentuada no início", () => {
    expect(limparNome("Água")).toBe("Água");
  });
});

describe("normalizarHora", () => {
  it("aceita as formas que aparecem em planilha", () => {
    expect(normalizarHora("7h00")).toBe("07:00");
    expect(normalizarHora("7h")).toBe("07:00");
    expect(normalizarHora("07:00")).toBe("07:00");
    expect(normalizarHora("7:05")).toBe("07:05");
    expect(normalizarHora("12h30")).toBe("12:30");
    expect(normalizarHora("20")).toBe("20:00");
  });

  it("rejeita o que não é hora", () => {
    for (const v of ["Após almoço", "manhã", "25h", "12h99", ""]) {
      expect(normalizarHora(v)).toBeNull();
    }
  });
});

describe("parseHorario", () => {
  it("separa início e fim", () => {
    expect(parseHorario("7h00 - 8h00")).toEqual({
      inicio: "07:00",
      fim: "08:00",
      ancora: null,
    });
  });

  it("aceita separadores variados", () => {
    for (const s of ["12h00-13h00", "12h00 às 13h00", "12h00 – 13h00", "12h00 as 13h00"]) {
      expect(parseHorario(s), s).toEqual({ inicio: "12:00", fim: "13:00", ancora: null });
    }
  });

  it("guarda a âncora quando o plano se refere a um evento", () => {
    // Inventar um horário para "Após almoço" perderia a instrução.
    expect(parseHorario("Após almoço")).toEqual({
      inicio: null,
      fim: null,
      ancora: "Após almoço",
    });
  });

  it("aceita só o início", () => {
    expect(parseHorario("15h00")).toEqual({ inicio: "15:00", fim: null, ancora: null });
  });

  it("devolve tudo nulo para célula vazia", () => {
    expect(parseHorario("")).toEqual({ inicio: null, fim: null, ancora: null });
  });
});

describe("parseKcal", () => {
  it("entende valor único, com til e com unidade", () => {
    expect(parseKcal("~400 kcal")).toEqual({ min: 400, max: 400 });
    expect(parseKcal("400kcal")).toEqual({ min: 400, max: 400 });
    expect(parseKcal("400")).toEqual({ min: 400, max: 400 });
  });

  it("entende faixa", () => {
    expect(parseKcal("1600-1800 kcal")).toEqual({ min: 1600, max: 1800 });
  });

  it("ordena a faixa invertida", () => {
    expect(parseKcal("1800-1600")).toEqual({ min: 1600, max: 1800 });
  });

  it("devolve null sem número", () => {
    expect(parseKcal("a combinar")).toBeNull();
    expect(parseKcal("")).toBeNull();
  });
});

describe("parseMl", () => {
  it("pega o alvo, não o detalhe entre parênteses", () => {
    // "750ml (3-4 copos de 200ml)": 200ml diz como fracionar, não é o alvo.
    expect(parseMl("750ml (3-4 copos de 200ml)")).toBe(750);
    expect(parseMl("1000ml (5 copos de 200ml)")).toBe(1000);
  });

  it("converte litros", () => {
    expect(parseMl("1L")).toBe(1000);
    expect(parseMl("1,5 litros")).toBe(1500);
    expect(parseMl("3 LITROS")).toBe(3000);
    expect(parseMl("3L/dia")).toBe(3000);
  });

  it("devolve null sem unidade reconhecível", () => {
    expect(parseMl("bastante")).toBeNull();
    expect(parseMl("750")).toBeNull();
  });
});

describe("parseGramas", () => {
  it("extrai gramas de uma porção", () => {
    expect(parseGramas("3 unidades (150g)")).toBe(150);
    expect(parseGramas("120g")).toBe(120);
    expect(parseGramas("1 col. sopa (10g)")).toBe(10);
  });

  it("devolve null quando a porção não é em gramas", () => {
    expect(parseGramas("1 unidade média")).toBeNull();
    expect(parseGramas("2 fatias")).toBeNull();
  });
});

describe("tipoDoBloco", () => {
  it("reconhece água pelo emoji e pelo nome", () => {
    expect(tipoDoBloco("💧 ÁGUA")).toBe("agua");
    expect(tipoDoBloco("ÁGUA")).toBe("agua");
    expect(tipoDoBloco("Hidratação")).toBe("agua");
  });

  it("reconhece suplemento pelo emoji e pelo nome", () => {
    expect(tipoDoBloco("🥤 CREATINA")).toBe("suplemento");
    expect(tipoDoBloco("Whey pós-treino")).toBe("suplemento");
    expect(tipoDoBloco("Ômega 3")).toBe("suplemento");
  });

  it("o resto é refeição", () => {
    expect(tipoDoBloco("Café da Manhã")).toBe("refeicao");
    expect(tipoDoBloco("Almoço")).toBe("refeicao");
    expect(tipoDoBloco("Lanche da Tarde")).toBe("refeicao");
  });

  it("não confunde refeição que menciona água no texto do nome", () => {
    expect(tipoDoBloco("Almoço")).toBe("refeicao");
  });
});

describe("ehLinhaResumo", () => {
  it("reconhece as linhas de fechamento", () => {
    expect(ehLinhaResumo("TOTAL ESTIMADO")).toBe(true);
    expect(ehLinhaResumo("TOTAL DIÁRIO")).toBe(true);
    expect(ehLinhaResumo("HIDRATAÇÃO TOTAL")).toBe(true);
  });

  it("não confunde com refeição", () => {
    expect(ehLinhaResumo("Café da Manhã")).toBe(false);
    expect(ehLinhaResumo("💧 ÁGUA")).toBe(false);
  });
});

describe("categoriaDoTexto", () => {
  it("classifica os itens do plano real", () => {
    expect(categoriaDoTexto("3 ovos mexidos/cozidos com espinafre e tomate")).toBe("proteina");
    expect(categoriaDoTexto("1 fatia de pão integral OU 2 col. sopa aveia")).toBe("carboidrato");
    expect(categoriaDoTexto("1 col. chá pasta de amendoim natural")).toBe("gordura");
    expect(categoriaDoTexto("1 fruta média (maçã ou mamão)")).toBe("fruta");
    expect(categoriaDoTexto("Salada abundante (alface, brócolis, cenoura)")).toBe("vegetal");
  });

  it("devolve null quando não reconhece, em vez de chutar", () => {
    // Categoria errada ofereceria a troca errada — pior do que não oferecer.
    expect(categoriaDoTexto("Café preto sem açúcar")).toBeNull();
  });
});

describe("acharCabecalho", () => {
  it("acha por nome de coluna, em qualquer ordem", () => {
    const grade: Grade = [
      ["ALIMENTOS", "REFEIÇÃO", "CALORIAS", "HORÁRIO"],
      ["ovos", "Café", "400", "7h"],
    ];
    expect(acharCabecalho(grade)).toEqual({
      linha: 0,
      colunas: { alimentos: 0, refeicao: 1, calorias: 2, horario: 3 },
    });
  });

  it("pula linhas de título até achar o cabeçalho", () => {
    expect(acharCabecalho(REAL["Plano"])?.linha).toBe(5);
  });

  it("devolve null sem as colunas mínimas", () => {
    expect(acharCabecalho([["ALGO", "OUTRO"], ["a", "b"]])).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════
   O ARQUIVO REAL — critério de aceite
   ══════════════════════════════════════════════════════════════════ */

describe("Plano-Cutting-Completo-ATUALIZADO.xlsx", () => {
  it("importa sem nenhum erro, sem edição no arquivo", () => {
    const { rascunho, problemas } = montarRascunho(abasReais());
    const { erros } = validarPlano(rascunho, problemas);
    expect(erros).toEqual([]);
  });

  it("lê as metas do cabeçalho", () => {
    const { rascunho } = montarRascunho(abasReais());
    expect(rascunho.meta).toMatchObject({
      nome: "PLANO DE CUTTING - LUÍS GABRIEL",
      kcal_min: 1700,
      kcal_max: 2000,
      prot_alvo_g: 150,
      agua_ml_alvo: 3000,
    });
  });

  it("produz 4 refeições, 4 blocos de água e 1 suplemento", () => {
    const { rascunho } = montarRascunho(abasReais());
    const porTipo = (t: string) => rascunho.blocos.filter((b) => b.tipo === t);
    expect(porTipo("refeicao").map((b) => b.nome)).toEqual([
      "Café da Manhã",
      "Almoço",
      "Lanche da Tarde",
      "Janta",
    ]);
    expect(porTipo("agua")).toHaveLength(4);
    expect(porTipo("suplemento").map((b) => b.nome)).toEqual(["CREATINA"]);
  });

  it("não transforma as linhas de total em blocos", () => {
    const { rascunho } = montarRascunho(abasReais());
    expect(rascunho.blocos.map((b) => b.nome)).not.toContain("TOTAL ESTIMADO");
    expect(rascunho.blocos.map((b) => b.nome)).not.toContain("HIDRATAÇÃO TOTAL");
    expect(rascunho.meta.total_kcal_declarado).toEqual({ min: 1600, max: 1800 });
    expect(rascunho.meta.agua_total_declarada_ml).toBe(3000);
  });

  it("agrupa os alimentos sob a refeição a que pertencem", () => {
    const { rascunho } = montarRascunho(abasReais());
    const cafe = rascunho.blocos.find((b) => b.nome === "Café da Manhã")!;
    expect(cafe.itens.map((i) => i.texto)).toEqual([
      "3 ovos mexidos/cozidos com espinafre e tomate",
      "1 fatia de pão integral OU 2 col. sopa aveia",
      "1 col. chá pasta de amendoim natural",
      "1 fruta média (maçã ou mamão)",
      "Café preto sem açúcar",
    ]);
    expect(cafe.hora_inicio).toBe("07:00");
    expect(cafe.hora_fim).toBe("08:00");
    expect(cafe.kcal_alvo).toBe(400);
  });

  it("lê os quatro períodos de água com o volume de cada um", () => {
    const { rascunho } = montarRascunho(abasReais());
    const agua = rascunho.blocos.filter((b) => b.tipo === "agua");
    expect(agua.map((b) => b.ml_alvo)).toEqual([750, 1000, 750, 500]);
    expect(agua.map((b) => [b.hora_inicio, b.hora_fim])).toEqual([
      ["08:00", "12:00"],
      ["13:00", "17:00"],
      ["17:00", "20:00"],
      ["20:00", "22:00"],
    ]);
    expect(agua[0].observacao).toBe("Distribuir ao longo da manhã");
  });

  it("ancora a creatina ao almoço em vez de inventar um horário", () => {
    const { rascunho } = montarRascunho(abasReais());
    const creatina = rascunho.blocos.find((b) => b.tipo === "suplemento")!;
    expect(creatina.hora_inicio).toBeNull();
    expect(creatina.ancora).toBe("Após almoço");
    expect(creatina.observacao).toBe("Misturar em 200ml de água ou suco");
    expect(creatina.itens[0].texto).toBe("3-5g creatina monohidratada");
  });

  it("lê os macros por refeição, sem a linha de total", () => {
    const { rascunho } = montarRascunho(abasReais());
    expect(rascunho.macros).toHaveLength(4);
    expect(rascunho.macros[0]).toEqual({
      block_nome: "Café da Manhã",
      prot_g: 25,
      carb_g: 35,
      gord_g: 15,
      kcal: 400,
    });
    expect(rascunho.macros.map((m) => m.block_nome)).not.toContain("TOTAL DIÁRIO");
  });

  it("lê as 39 substituições com porção e caloria", () => {
    const { rascunho } = montarRascunho(abasReais());
    expect(rascunho.substituicoes).toHaveLength(39);
    expect(rascunho.substituicoes[0]).toEqual({
      block_nome: "Café da Manhã",
      categoria: "proteina",
      alimento: "Ovos inteiros",
      porcao: "3 unidades (150g)",
      qty_g: 150,
      kcal: 210,
    });
  });

  it("todo nome usado em Macros e Substituicoes existe entre os blocos", () => {
    const { rascunho, problemas } = montarRascunho(abasReais());
    const { avisos } = validarPlano(rascunho, problemas);
    expect(avisos.filter((a) => /não corresponde/.test(a.mensagem))).toEqual([]);
  });

  it("não reclama do total: a soma cabe na tolerância", () => {
    // 400+500+300+400 = 1600 contra os 1700 do ponto médio de 1600-1800:
    // 6% de desvio, dentro dos 15% tolerados.
    const { rascunho, problemas } = montarRascunho(abasReais());
    const { avisos } = validarPlano(rascunho, problemas);
    expect(avisos.filter((a) => /total/.test(a.onde))).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════
   ENTRADA MALFORMADA
   ══════════════════════════════════════════════════════════════════ */

const cabecalhoPadrao = ["REFEIÇÃO", "HORÁRIO", "ALIMENTOS", "CALORIAS", "OBSERVAÇÕES"];

const gradeCom = (...linhas: Grade): Grade => [cabecalhoPadrao, ...linhas];

describe("entrada malformada", () => {
  it("erra quando não há cabeçalho reconhecível", () => {
    const { rascunho, problemas } = montarRascunho({
      plano: [["qualquer", "coisa"], ["a", "b"]],
      macros: null,
      substituicoes: null,
    });
    const { erros } = validarPlano(rascunho, problemas);
    expect(erros.some((e) => /cabeçalho/i.test(e.mensagem))).toBe(true);
  });

  it("erra quando não há nenhuma refeição", () => {
    const { rascunho, problemas } = montarRascunho({
      plano: gradeCom(["💧 ÁGUA", "8h - 12h", "750ml", null, null]),
      macros: null,
      substituicoes: null,
    });
    const { erros } = validarPlano(rascunho, problemas);
    expect(erros.some((e) => /Nenhuma refeição/.test(e.mensagem))).toBe(true);
  });

  it("erra quando uma refeição está sem alimento", () => {
    const { rascunho, problemas } = montarRascunho({
      plano: gradeCom(["Almoço", "12h - 13h", null, "500 kcal", null]),
      macros: null,
      substituicoes: null,
    });
    const { erros } = validarPlano(rascunho, problemas);
    expect(erros.some((e) => /sem nenhum alimento/.test(e.mensagem))).toBe(true);
  });

  it("erra em nome de refeição repetido", () => {
    // Macros e Substituicoes casam pelo nome; duplicado torna o casamento ambíguo.
    const { rascunho, problemas } = montarRascunho({
      plano: gradeCom(
        ["Almoço", "12h", "arroz", "500", null],
        ["Almoço", "19h", "frango", "400", null],
      ),
      macros: null,
      substituicoes: null,
    });
    const { erros } = validarPlano(rascunho, problemas);
    expect(erros.some((e) => /duas vezes/.test(e.mensagem))).toBe(true);
  });

  it("avisa, sem impedir, quando o horário é ilegível", () => {
    const { rascunho, problemas } = montarRascunho({
      plano: gradeCom(["Almoço", "99:99", "arroz", "500", null]),
      macros: null,
      substituicoes: null,
    });
    const { erros, avisos } = validarPlano(rascunho, problemas);
    expect(erros).toEqual([]);
    expect(avisos.some((a) => /horário/.test(a.mensagem))).toBe(true);
    expect(rascunho.blocos[0].ancora).toBe("99:99");
  });

  it("avisa quando o bloco de água não diz o volume", () => {
    const { rascunho, problemas } = montarRascunho({
      plano: gradeCom(
        ["Almoço", "12h", "arroz", "500", null],
        ["💧 ÁGUA", "8h - 12h", "bastante", null, null],
      ),
      macros: null,
      substituicoes: null,
    });
    const { avisos } = validarPlano(rascunho, problemas);
    expect(avisos.some((a) => /quantos ml/.test(a.mensagem))).toBe(true);
  });

  it("avisa quando o total declarado destoa da soma", () => {
    const { rascunho, problemas } = montarRascunho({
      plano: gradeCom(
        ["Almoço", "12h", "arroz", "500 kcal", null],
        ["TOTAL ESTIMADO", null, null, "3000 kcal", null],
      ),
      macros: null,
      substituicoes: null,
    });
    const { avisos } = validarPlano(rascunho, problemas);
    expect(avisos.some((a) => a.onde === "total do plano")).toBe(true);
  });

  it("avisa quando as abas Macros e Substituicoes não existem", () => {
    const { problemas } = montarRascunho({
      plano: gradeCom(["Almoço", "12h", "arroz", "500", null]),
      macros: null,
      substituicoes: null,
    });
    expect(problemas.filter((p) => p.nivel === "aviso")).toHaveLength(2);
  });

  it("avisa quando um nome de Macros não casa com nenhum bloco", () => {
    const { rascunho, problemas } = montarRascunho({
      plano: gradeCom(["Almoço", "12h", "arroz", "500", null]),
      macros: [
        ["Refeição", "Proteína (g)", "Carboidrato (g)", "Gordura (g)", "Calorias (kcal)"],
        ["Café da Tarde", 20, 30, 10, 300],
      ],
      substituicoes: null,
    });
    const { avisos } = validarPlano(rascunho, problemas);
    expect(avisos.some((a) => /não corresponde/.test(a.mensagem))).toBe(true);
  });

  it("ignora alimento solto antes da primeira refeição", () => {
    const { rascunho, problemas } = montarRascunho({
      plano: gradeCom(
        [null, null, "sobrou daqui", null, null],
        ["Almoço", "12h", "arroz", "500", null],
      ),
      macros: null,
      substituicoes: null,
    });
    expect(rascunho.blocos).toHaveLength(1);
    expect(problemas.some((p) => /antes de qualquer refeição/.test(p.mensagem))).toBe(true);
  });

  it("aceita planilha sem coluna de observações", () => {
    const { rascunho, problemas } = montarRascunho({
      plano: [
        ["REFEIÇÃO", "HORÁRIO", "ALIMENTOS", "CALORIAS"],
        ["Almoço", "12h - 13h", "arroz", "500 kcal"],
      ],
      macros: null,
      substituicoes: null,
    });
    const { erros } = validarPlano(rascunho, problemas);
    expect(erros).toEqual([]);
    expect(rascunho.blocos[0].observacao).toBeNull();
  });

  it("pula linhas totalmente vazias entre blocos", () => {
    const { rascunho } = montarRascunho({
      plano: gradeCom(
        ["Almoço", "12h", "arroz", "500", null],
        [null, null, null, null, null],
        ["Janta", "19h", "peixe", "400", null],
      ),
      macros: null,
      substituicoes: null,
    });
    expect(rascunho.blocos).toHaveLength(2);
  });
});

describe("parseMacros isolado", () => {
  it("aceita colunas em ordem diferente", () => {
    const { macros } = parseMacros([
      ["Calorias (kcal)", "Refeição", "Gordura (g)", "Proteína (g)", "Carboidrato (g)"],
      [400, "Café", 15, 25, 35],
    ]);
    expect(macros[0]).toEqual({
      block_nome: "Café",
      prot_g: 25,
      carb_g: 35,
      gord_g: 15,
      kcal: 400,
    });
  });

  it("ignora linha com valor faltando, avisando", () => {
    const { macros, problemas } = parseMacros([
      ["Refeição", "Proteína (g)", "Carboidrato (g)", "Gordura (g)", "Calorias (kcal)"],
      ["Café", 25, null, 15, 400],
    ]);
    expect(macros).toEqual([]);
    expect(problemas[0].mensagem).toMatch(/valores faltando/);
  });
});

describe("parseSubstituicoes isolado", () => {
  it("normaliza a categoria para casar com a do item", () => {
    const { substituicoes } = parseSubstituicoes([
      ["Refeição", "Categoria", "Alimento", "Porção", "Calorias (kcal)"],
      ["Almoço", "Proteína", "Frango", "120g", 130],
    ]);
    expect(substituicoes[0].categoria).toBe("proteina");
  });

  it("ignora linha sem caloria, avisando", () => {
    const { substituicoes, problemas } = parseSubstituicoes([
      ["Refeição", "Categoria", "Alimento", "Porção", "Calorias (kcal)"],
      ["Almoço", "Proteína", "Frango", "120g", null],
    ]);
    expect(substituicoes).toEqual([]);
    expect(problemas[0].mensagem).toMatch(/sem calorias/);
  });
});

describe("parsePlano isolado", () => {
  it("não quebra com planilha só de cabeçalho", () => {
    const r = parsePlano([cabecalhoPadrao]);
    expect(r.blocos).toEqual([]);
    expect(r.problemas).toEqual([]);
  });

  it("não quebra com grade vazia", () => {
    const r = parsePlano([]);
    expect(r.blocos).toEqual([]);
    expect(r.problemas[0].nivel).toBe("erro");
  });
});

describe("blocos que se repetem de propósito", () => {
  it("aceita vários períodos de água com o mesmo nome", () => {
    // Um plano normal tem "ÁGUA" quatro vezes, separada pelo horário. Exigir
    // nome único aqui rejeitaria a planilha do usuário.
    const { rascunho, problemas } = montarRascunho({
      plano: [
        ["REFEIÇÃO", "HORÁRIO", "ALIMENTOS", "CALORIAS", "OBSERVAÇÕES"],
        ["Almoço", "12h", "arroz", "500", null],
        ["💧 ÁGUA", "8h - 12h", "750ml", null, null],
        ["💧 ÁGUA", "13h - 17h", "1000ml", null, null],
      ],
      macros: null,
      substituicoes: null,
    });
    const { erros } = validarPlano(rascunho, problemas);
    expect(erros).toEqual([]);
    expect(rascunho.blocos.filter((b) => b.tipo === "agua")).toHaveLength(2);
  });
});

describe("horário com prefixo", () => {
  it("entende 'das 7h às 8h'", () => {
    expect(parseHorario("das 7h às 8h")).toEqual({
      inicio: "07:00",
      fim: "08:00",
      ancora: null,
    });
  });

  it("entende 'entre 12h e 13h'", () => {
    expect(parseHorario("entre 12h - 13h")).toEqual({
      inicio: "12:00",
      fim: "13:00",
      ancora: null,
    });
  });
});
