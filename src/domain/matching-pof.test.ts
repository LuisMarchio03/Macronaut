import { describe, it, expect } from "vitest";
import { numeroPof, cabecaTaco, cabecaPof, estadoTaco, preparacaoCasa, casar, qualificadoresTaco, type PofLinha } from "./matching-pof";

describe("numeroPof", () => {
  it("aceita decimal com vírgula (formato real do XLS do IBGE)", () => {
    expect(numeroPof("56,3")).toBe(56.3);
    expect(numeroPof("6,3")).toBe(6.3);
    expect(numeroPof("140")).toBe(140);
  });

  it("devolve 0 para vazio ou lixo", () => {
    expect(numeroPof("")).toBe(0);
    expect(numeroPof("  ")).toBe(0);
    expect(numeroPof("n/a")).toBe(0);
  });
});

describe("cabecaTaco", () => {
  it("pega o primeiro segmento antes da vírgula, normalizado", () => {
    expect(cabecaTaco("Arroz, integral, cozido")).toBe("arroz");
    expect(cabecaTaco("Pão, trigo, forma, integral")).toBe("pao");
    expect(cabecaTaco("Feijão, carioca, cozido")).toBe("feijao");
  });

  it("funciona sem vírgula", () => {
    expect(cabecaTaco("Pipoca")).toBe("pipoca");
  });
});

describe("cabecaPof", () => {
  it("pega a primeira palavra, normalizada, ignorando parênteses", () => {
    expect(cabecaPof("ARROZ (POLIDO, PARBOILIZADO)")).toBe("arroz");
    expect(cabecaPof("FEIJAO CARIOCA/CARIOQUINHA COZIDO")).toBe("feijao");
    expect(cabecaPof("PAO DE FORMA INDUSTRIALIZADO DE QUALQUER MARCA")).toBe("pao");
  });
});

describe("estadoTaco", () => {
  it("reconhece o estado no último segmento", () => {
    expect(estadoTaco("Arroz, integral, cozido")).toBe("cozido");
    expect(estadoTaco("Manga, Haden, crua")).toBe("cru");
    expect(estadoTaco("Ovo, de galinha, frito")).toBe("frito");
  });

  it("normaliza gênero: crua→cru, cozida→cozido", () => {
    expect(estadoTaco("Banana, prata, crua")).toBe("cru");
    expect(estadoTaco("Batata, doce, cozida")).toBe("cozido");
  });

  it("devolve null quando o último segmento não é estado", () => {
    expect(estadoTaco("Pão, trigo, forma, integral")).toBeNull();
    expect(estadoTaco("Pipoca")).toBeNull();
    // Não-preparos reais da TACO que jamais podem virar estado:
    expect(estadoTaco("Biscoito, doce, maisena")).toBeNull();
    expect(estadoTaco("Biscoito, doce, recheado com chocolate")).toBeNull();
  });

  // REGRESSÃO: nomes REAIS da TACO onde o estado vem colado a qualificador.
  // Match exato devolvia null nos 5, e null faz `preparacaoCasa` virar wildcard
  // — o ovo casaria cru (45g) E frito (50g) do mesmo código POF, e "1 unidade"
  // passaria a valer 45 ou 50 g conforme a ordem das linhas. Silenciosamente.
  it("REGRESSÃO: acha o estado colado a qualificador (os 5 casos reais)", () => {
    expect(estadoTaco("Ovo, de galinha, inteiro, cozido/10minutos")).toBe("cozido");
    expect(estadoTaco("Ovo, de galinha, clara, cozida/10minutos")).toBe("cozido");
    expect(estadoTaco("Ovo, de galinha, gema, cozida/10minutos")).toBe("cozido");
    expect(estadoTaco("Cuscuz, de milho, cozido com sal")).toBe("cozido");
    expect(estadoTaco("Salada, de legumes, cozida no vapor")).toBe("cozido");
  });
});

describe("preparacaoCasa", () => {
  it("casa estado da TACO com preparação da POF", () => {
    expect(preparacaoCasa("cozido", "COZIDO(A)")).toBe(true);
    expect(preparacaoCasa("cru", "CRU(A)")).toBe(true);
    expect(preparacaoCasa("frito", "FRITO(A)")).toBe(true);
  });

  it("tolera o typo do próprio IBGE: CROZIDO(A)", () => {
    // O arquivo tabelamedidas_bd.xls tem 'CROZIDO(A)' em vez de 'COZIDO(A)'.
    // Não é erro nosso de digitação — é o dado da fonte. Normalizar às cegas
    // (ex.: remover o R) quebraria 'CRU'. Tratamos como alias explícito.
    expect(preparacaoCasa("cozido", "CROZIDO(A)")).toBe(true);
  });

  it("não casa estados diferentes", () => {
    expect(preparacaoCasa("cru", "COZIDO(A)")).toBe(false);
    expect(preparacaoCasa("cozido", "FRITO(A)")).toBe(false);
  });

  it("estado null casa com qualquer preparação (TACO não disse)", () => {
    expect(preparacaoCasa(null, "COZIDO(A)")).toBe(true);
    expect(preparacaoCasa(null, "CRU(A)")).toBe(true);
  });

  // REGRESSÃO (defeito 1 — CRITICAL): 'NAO SE APLICA' é 54% das 11.801 linhas
  // do tabelamedidas_bd.xls real. Não é "preparação desconhecida": é o alimento
  // não tendo dimensão de preparo (arroz é arroz). Tratá-la como incompatível
  // fazia os 14 códigos de ARROZ da POF — que usam EXCLUSIVAMENTE essa string —
  // nunca casarem com "Arroz, integral, cozido", o 1º item do taco.json.
  it("REGRESSÃO: 'NAO SE APLICA' é curinga do lado da POF (defeito 1)", () => {
    expect(preparacaoCasa("cozido", "NAO SE APLICA")).toBe(true);
    expect(preparacaoCasa(null, "NAO SE APLICA")).toBe(true);
  });

  // REGRESSÃO (defeito 2 — CRITICAL): a grafia real e COMPLETA no arquivo é
  // 'GRELHADO(A)/BRASA/CHURRASCO', não 'grelhado(a)'. O alias errado fazia os
  // 22 alimentos grelhados da TACO caírem todos em semMatch.
  it("REGRESSÃO: alias completo de grelhado bate com a grafia real da POF (defeito 2)", () => {
    expect(preparacaoCasa("grelhado", "GRELHADO(A)/BRASA/CHURRASCO")).toBe(true);
  });

  // Pratos reais da POF (ENSOPADO, MOLHO VERMELHO, EMPANADO, SOPA, MINGAU...)
  // não são estados de preparo do mesmo alimento — são pratos diferentes. A
  // TACO não os modela, então NÃO podem casar mesmo com um estado válido.
  it("não casa pratos da POF que não são estado de preparo (ENSOPADO, MOLHO VERMELHO)", () => {
    expect(preparacaoCasa("cozido", "ENSOPADO")).toBe(false);
    expect(preparacaoCasa("cozido", "MOLHO VERMELHO")).toBe(false);
  });
});

describe("casar", () => {
  // Preparações usam a grafia REAL do tabelamedidas_bd.xls do IBGE:
  // 'CROZIDO(A)' — 'COZIDO(A)' não existe no arquivo (typo do próprio IBGE).
  const pof: PofLinha[] = [
    { codigo: "101", descricao: "ARROZ (POLIDO, PARBOILIZADO)", preparacao: "CROZIDO(A)",
      medida: "COLHER DE SOPA", gramas: 25 },
    { codigo: "101", descricao: "ARROZ (POLIDO, PARBOILIZADO)", preparacao: "CROZIDO(A)",
      medida: "CONCHA", gramas: 100 },
    { codigo: "201", descricao: "FEIJAO CARIOCA/CARIOQUINHA", preparacao: "CROZIDO(A)",
      medida: "CONCHA", gramas: 140 },
    { codigo: "202", descricao: "FEIJAO TROPEIRO", preparacao: "CROZIDO(A)",
      medida: "COLHER DE SOPA", gramas: 35 },
    { codigo: "301", descricao: "MANGA", preparacao: "CRU(A)",
      medida: "UNIDADE", gramas: 300 },
    { codigo: "401", descricao: "ASA DE PERU", preparacao: "CROZIDO(A)",
      medida: "UNIDADE", gramas: 90 },
    { codigo: "501", descricao: "MANTEIGA COM OU SEM SAL", preparacao: "CRU(A)",
      medida: "COLHER DE CHA", gramas: 5 },
  ];

  it("cabeça única → confirmada, com todas as medidas daquele código", () => {
    const r = casar([{ nome: "Arroz, integral, cozido" }], pof);
    expect(r.confirmadas).toHaveLength(1);
    expect(r.candidatas).toHaveLength(0);
    const medidas = r.confirmadas[0].candidatos[0].medidas;
    expect(medidas).toHaveLength(2);
    expect(medidas.map((m) => m.nome).sort()).toEqual(["colher de sopa", "concha"]);
    expect(medidas.find((m) => m.nome === "concha")?.qty_base).toBe(100);
  });

  it("cabeça com >1 código → candidata, preservando todos os candidatos", () => {
    // "preto" (não "carioca"): "carioca" bateria literalmente em
    // "FEIJAO CARIOCA/CARIOQUINHA" e o estreitamento por qualificador (ver
    // describe abaixo) reduziria a 1 candidato — o que é o comportamento
    // CORRETO da nova feature, só não serve para testar "sem discriminação
    // clara, mantém todos". "preto" não aparece em nenhuma das duas descrições.
    const r = casar([{ nome: "Feijão, preto, cozido" }], pof);
    expect(r.confirmadas).toHaveLength(0);
    expect(r.candidatas).toHaveLength(1);
    expect(r.candidatas[0].candidatos).toHaveLength(2);
    // pof_codigo é a chave composta `<código>|<preparação>` (defeito 3: dedup
    // só por código escondia conflitos de gramas entre preparações).
    expect(r.candidatas[0].candidatos.map((c) => c.pof_codigo).sort()).toEqual([
      "201|crozido(a)",
      "202|crozido(a)",
    ]);
  });

  it("sem cabeça correspondente → semMatch", () => {
    const r = casar([{ nome: "Cereal matinal, milho" }], pof);
    expect(r.semMatch).toEqual(["Cereal matinal, milho"]);
  });

  it("preparação filtra: manga crua não pega linha de cozido", () => {
    const r = casar([{ nome: "Manga, Haden, crua" }], pof);
    expect(r.confirmadas).toHaveLength(1);
    expect(r.confirmadas[0].candidatos[0].pof_codigo).toBe("301|cru(a)");
  });

  // --- REGRESSÃO: falsos positivos reais medidos com fuzzy matching (difflib,
  // score 0.59) sobre os dados de verdade. Se algum destes voltar a casar, o
  // app serve peso de asa de peru como se fosse manga. Ver spec, decisão D3.
  it("REGRESSÃO: 'Manga, Haden, crua' jamais casa com ASA DE PERU", () => {
    const r = casar([{ nome: "Manga, Haden, crua" }], pof);
    // pof_codigo agora é a chave composta "<código>|<preparação>"; comparamos
    // só o código (antes do "|") para o teste continuar válido mesmo com a
    // chave composta introduzida pelo defeito 3.
    const codigos = [...r.confirmadas, ...r.candidatas]
      .flatMap((t) => t.candidatos.map((c) => c.pof_codigo.split("|")[0]));
    expect(codigos).not.toContain("401");
  });

  it("REGRESSÃO: 'Pipoca, com óleo de soja' jamais casa com MANTEIGA", () => {
    const r = casar([{ nome: "Pipoca, com óleo de soja" }], pof);
    const codigos = [...r.confirmadas, ...r.candidatas]
      .flatMap((t) => t.candidatos.map((c) => c.pof_codigo.split("|")[0]));
    expect(codigos).not.toContain("501");
    expect(r.semMatch).toContain("Pipoca, com óleo de soja");
  });

  it("nome de medida sai normalizado (vira rótulo de UI)", () => {
    const r = casar([{ nome: "Arroz, integral, cozido" }], pof);
    // "COLHER DE SOPA" no XLS → "colher de sopa" na tela.
    expect(r.confirmadas[0].candidatos[0].medidas.map((m) => m.nome)).toContain("colher de sopa");
  });

  it("descarta medida com gramas <= 0 (CHECK qty_base > 0 no schema)", () => {
    const comZero: PofLinha[] = [
      { codigo: "601", descricao: "ABOBORA", preparacao: "CRU(A)", medida: "FATIA", gramas: 0 },
      { codigo: "601", descricao: "ABOBORA", preparacao: "CRU(A)", medida: "UNIDADE", gramas: 500 },
    ];
    const r = casar([{ nome: "Abóbora, crua" }], comZero);
    expect(r.confirmadas[0].candidatos[0].medidas).toHaveLength(1);
    expect(r.confirmadas[0].candidatos[0].medidas[0].nome).toBe("unidade");
  });

  // --- REGRESSÃO fim-a-fim (defeito 1 — CRITICAL): os fixtures acima usam
  // "CROZIDO(A)"/"CRU(A)" — grafias que EXISTEM no POF real, mas nunca exercitam
  // o caso mais comum do arquivo: 'NAO SE APLICA' (54% das 11.801 linhas). Os 14
  // códigos de ARROZ da POF usam EXCLUSIVAMENTE essa string. Com o defeito
  // original (NAO SE APLICA tratada como incompatível), este teste falha:
  // "Arroz, integral, cozido" caía em semMatch em vez de confirmada.
  it("REGRESSÃO: alimento com preparação 'NAO SE APLICA' (curinga real da POF) casa como confirmada, não semMatch", () => {
    const pofRealista: PofLinha[] = [
      { codigo: "6801101", descricao: "ARROZ (POLIDO, PARBOILIZADO)", preparacao: "NAO SE APLICA",
        medida: "COLHER DE SOPA", gramas: 25 },
      { codigo: "6801101", descricao: "ARROZ (POLIDO, PARBOILIZADO)", preparacao: "NAO SE APLICA",
        medida: "CONCHA", gramas: 100 },
    ];
    const r = casar([{ nome: "Arroz, integral, cozido" }], pofRealista);
    expect(r.semMatch).toEqual([]);
    expect(r.confirmadas).toHaveLength(1);
    expect(r.candidatas).toHaveLength(0);
    expect(r.confirmadas[0].candidatos[0].medidas.map((m) => m.nome).sort()).toEqual([
      "colher de sopa",
      "concha",
    ]);
  });

  // --- REGRESSÃO fim-a-fim (defeito 3 — CRITICAL): mesmo código POF, mesma
  // medida, gramas CONFLITANTES entre preparações diferentes — caso real
  // medido: "prato de sobremesa" de banana doce em barra vale 170 g crua e
  // 22 g assada (8x de diferença). Com dedup só por código, a 1ª linha do XLS
  // vencia em silêncio E o alimento ainda caía em `confirmadas`, pulando a
  // desambiguação do usuário. Com a chave composta (código, preparação), vira
  // `candidata` com os 2 valores preservados — o usuário decide.
  it("REGRESSÃO: mesmo código+medida com gramas conflitantes em preparações diferentes vira candidata, nenhuma grama escolhida em silêncio", () => {
    const pofConflito: PofLinha[] = [
      { codigo: "9101101", descricao: "BANANA DOCE EM BARRA", preparacao: "CRU(A)",
        medida: "PRATO DE SOBREMESA", gramas: 170 },
      { codigo: "9101101", descricao: "BANANA DOCE EM BARRA", preparacao: "ASSADO(A)",
        medida: "PRATO DE SOBREMESA", gramas: 22 },
    ];
    // "Banana, doce, em barra" não tem estado reconhecível no último segmento
    // ("em barra"), então estadoTaco -> null e ambas as preparações passam no
    // filtro — exatamente como o alimento real da TACO se comporta aqui.
    const r = casar([{ nome: "Banana, doce, em barra" }], pofConflito);
    expect(r.confirmadas).toHaveLength(0);
    expect(r.candidatas).toHaveLength(1);
    expect(r.candidatas[0].candidatos).toHaveLength(2);
    const gramasPorCandidato = r.candidatas[0].candidatos
      .map((c) => c.medidas.find((m) => m.nome === "prato de sobremesa")?.qty_base)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(gramasPorCandidato).toEqual([22, 170]);
  });

  // Estreitamento por qualificador. A cabeça sozinha é grosseira demais:
  // "carne" casa toda carne da POF (155 candidatos reais no pior caso).
  it("estreita por qualificador: 'bovina' descarta o candidato suíno", () => {
    const carnes: PofLinha[] = [
      { codigo: "701", descricao: "CARNE BOVINA", preparacao: "CROZIDO(A)", medida: "BIFE", gramas: 100 },
      { codigo: "702", descricao: "CARNE SUINA", preparacao: "CROZIDO(A)", medida: "BIFE", gramas: 90 },
    ];
    const r = casar([{ nome: "Carne, bovina, acém, cozido" }], carnes);
    expect(r.confirmadas).toHaveLength(1);   // sobrou 1 -> deixa de ser ambíguo
    expect(r.candidatas).toHaveLength(0);
    expect(r.confirmadas[0].candidatos[0].pof_descricao).toContain("BOVINA");
  });

  it("sem qualificador que bate, mantém todos (estreitar até zero é pior)", () => {
    const carnes: PofLinha[] = [
      { codigo: "701", descricao: "CARNE BOVINA", preparacao: "CROZIDO(A)", medida: "BIFE", gramas: 100 },
      { codigo: "702", descricao: "CARNE SUINA", preparacao: "CROZIDO(A)", medida: "BIFE", gramas: 90 },
    ];
    // "zebu" não aparece em nenhuma descrição da POF: não pode zerar o alimento.
    const r = casar([{ nome: "Carne, zebu, cozido" }], carnes);
    expect(r.candidatas).toHaveLength(1);
    expect(r.candidatas[0].candidatos).toHaveLength(2);
  });

  it("qualificadoresTaco ignora cabeça, estado e palavras vazias", () => {
    expect(qualificadoresTaco("Carne, bovina, acém, moído, cozido"))
      .toEqual(["bovina", "acem", "moido"]);
    expect(qualificadoresTaco("Ovo, de galinha, inteiro, cozido/10minutos"))
      .toEqual(["galinha", "inteiro"]); // "de" cai por irrelevante; o estado sai
    expect(qualificadoresTaco("Pipoca")).toEqual([]);
  });
});
