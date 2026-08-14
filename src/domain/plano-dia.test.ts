import { describe, it, expect } from "vitest";
import {
  aderenciaDoDia,
  blocoEmFoco,
  metaDeAgua,
  montarDia,
  trocasDoBloco,
  trocasPara,
} from "./plano-dia";
import type { PlanBlock, PlanCheck, PlanSwap } from "./plano-types";

const bloco = (p: Partial<PlanBlock> & { id: number }): PlanBlock => ({
  plan_id: 1,
  tipo: "refeicao",
  nome: `Bloco ${p.id}`,
  hora_inicio: null,
  hora_fim: null,
  ancora: null,
  kcal_alvo: null,
  ml_alvo: null,
  observacao: null,
  ordem: p.id,
  ...p,
});

const check = (block_id: number, feito = true): PlanCheck => ({
  id: block_id,
  user_id: 1,
  plan_id: 1,
  data: "2026-08-14",
  block_id,
  feito,
  swap_id: null,
  created_at: "",
});

const as = (h: number, m = 0) => h * 60 + m;

const DIA_PADRAO = [
  bloco({ id: 1, nome: "Café da Manhã", hora_inicio: "07:00", hora_fim: "08:00" }),
  bloco({ id: 2, nome: "Almoço", hora_inicio: "12:00", hora_fim: "13:00" }),
  bloco({ id: 3, nome: "Lanche", hora_inicio: "15:00", hora_fim: "16:00" }),
  bloco({ id: 4, nome: "Janta", hora_inicio: "19:00", hora_fim: "20:00" }),
];

describe("montarDia", () => {
  it("marca como agora o bloco cuja janela contém o momento", () => {
    const dia = montarDia(DIA_PADRAO, [], as(12, 30));
    expect(dia.map((b) => b.estado)).toEqual(["atrasado", "agora", "proximo", "proximo"]);
  });

  it("marca como feito o que já foi checado, mesmo fora da janela", () => {
    const dia = montarDia(DIA_PADRAO, [check(1)], as(12, 30));
    expect(dia[0].estado).toBe("feito");
  });

  it("desmarcado explicitamente não conta como feito", () => {
    const dia = montarDia(DIA_PADRAO, [check(2, false)], as(12, 30));
    expect(dia[1].estado).toBe("agora");
    expect(dia[1].check?.feito).toBe(false);
  });

  it("dá meia hora de tolerância antes de chamar de atrasado", () => {
    // Sair da mesa 20 minutos depois do fim da janela não é furar a dieta.
    expect(montarDia(DIA_PADRAO, [], as(13, 20))[1].estado).toBe("agora");
    expect(montarDia(DIA_PADRAO, [], as(13, 45))[1].estado).toBe("atrasado");
  });

  it("dá uma janela padrão de uma hora quando não há hora de fim", () => {
    const semFim = [bloco({ id: 1, hora_inicio: "12:00", hora_fim: null })];
    expect(montarDia(semFim, [], as(12, 45))[0].estado).toBe("agora");
    expect(montarDia(semFim, [], as(11, 30))[0].estado).toBe("proximo");
    expect(montarDia(semFim, [], as(14, 0))[0].estado).toBe("atrasado");
  });

  it("bloco ancorado a evento fica pendente, nunca atrasado", () => {
    // "Após almoço" não tem relógio; chamá-lo de atrasado seria inventar
    // um prazo que o plano não define.
    const ancorado = [bloco({ id: 1, hora_inicio: null, ancora: "Após almoço" })];
    expect(montarDia(ancorado, [], as(23, 0))[0].estado).toBe("pendente");
  });

  it("noutro dia que não hoje, nada é 'agora' nem 'atrasado'", () => {
    // "Agora" não significa nada num dia que já passou.
    const dia = montarDia(DIA_PADRAO, [check(1)], null);
    expect(dia.map((b) => b.estado)).toEqual(["feito", "pendente", "pendente", "pendente"]);
  });

  it("aceita lista vazia", () => {
    expect(montarDia([], [], as(12))).toEqual([]);
  });

  it("ignora horário malformado tratando o bloco como pendente", () => {
    const sujo = [bloco({ id: 1, hora_inicio: "99:99" })];
    expect(montarDia(sujo, [], as(12))[0].estado).toBe("pendente");
  });
});

describe("blocoEmFoco", () => {
  it("prefere o que está acontecendo agora", () => {
    const dia = montarDia(DIA_PADRAO, [], as(12, 30));
    expect(blocoEmFoco(dia)?.bloco.nome).toBe("Almoço");
  });

  it("sem nada agora, aponta o próximo", () => {
    const dia = montarDia(DIA_PADRAO, [], as(10, 0));
    expect(blocoEmFoco(dia)?.bloco.nome).toBe("Almoço");
  });

  it("sem próximo, aponta o atrasado", () => {
    const dia = montarDia(DIA_PADRAO, [check(4)], as(23, 0));
    expect(blocoEmFoco(dia)?.bloco.nome).toBe("Café da Manhã");
  });

  it("entre dois blocos 'agora', escolhe o que começou por último", () => {
    // A tolerância de 30min mantém a água das 8h como "agora" às 12h20; sem
    // desempate ela roubaria o destaque do almoço que acabou de abrir.
    const comAgua = [
      bloco({ id: 9, tipo: "agua", nome: "ÁGUA", hora_inicio: "08:00", hora_fim: "12:00" }),
      ...DIA_PADRAO,
    ];
    const dia = montarDia(comAgua, [], as(12, 20));
    expect(dia.filter((b) => b.estado === "agora")).toHaveLength(2);
    expect(blocoEmFoco(dia)?.bloco.nome).toBe("Almoço");
  });

  it("dia inteiro cumprido não destaca nada", () => {
    const dia = montarDia(DIA_PADRAO, [1, 2, 3, 4].map((i) => check(i)), as(23, 0));
    expect(blocoEmFoco(dia)).toBeNull();
  });
});

describe("aderenciaDoDia", () => {
  it("conta só refeições", () => {
    // Contar água junto faria "4 de 4" significar coisas diferentes a cada dia.
    const blocos = [
      ...DIA_PADRAO,
      bloco({ id: 5, tipo: "agua", hora_inicio: "08:00" }),
      bloco({ id: 6, tipo: "suplemento", ancora: "Após almoço" }),
    ];
    const dia = montarDia(blocos, [check(1), check(2), check(5), check(6)], as(14));
    expect(aderenciaDoDia(dia)).toEqual({ feitas: 2, total: 4, pct: 50 });
  });

  it("devolve zero, não NaN, sem nenhuma refeição", () => {
    const dia = montarDia([bloco({ id: 1, tipo: "agua" })], [], as(12));
    expect(aderenciaDoDia(dia)).toEqual({ feitas: 0, total: 0, pct: 0 });
  });

  it("chega a 100 com tudo feito", () => {
    const dia = montarDia(DIA_PADRAO, [1, 2, 3, 4].map((i) => check(i)), as(23));
    expect(aderenciaDoDia(dia).pct).toBe(100);
  });
});

describe("metaDeAgua", () => {
  it("soma os períodos do plano", () => {
    const blocos = [
      bloco({ id: 1, tipo: "agua", ml_alvo: 750 }),
      bloco({ id: 2, tipo: "agua", ml_alvo: 1000 }),
      bloco({ id: 3, tipo: "refeicao" }),
    ];
    expect(metaDeAgua(blocos, 3000)).toBe(1750);
  });

  it("cai no alvo global quando não há período de água", () => {
    expect(metaDeAgua([bloco({ id: 1, tipo: "refeicao" })], 3000)).toBe(3000);
  });

  it("devolve zero quando não há nem período nem alvo", () => {
    expect(metaDeAgua([], null)).toBe(0);
  });
});

/* ── substituições ───────────────────────────────────────────────── */

const swap = (p: Partial<PlanSwap> & { id: number }): PlanSwap => ({
  plan_id: 1,
  block_nome: "Café da Manhã",
  categoria: "proteina",
  alimento: `Alimento ${p.id}`,
  porcao: "100g",
  qty_g: 100,
  kcal: 100,
  food_id: null,
  ...p,
});

describe("trocasPara", () => {
  const SWAPS = [
    swap({ id: 1, categoria: "proteina", alimento: "Ovos" }),
    swap({ id: 2, categoria: "carboidrato", alimento: "Aveia" }),
    swap({ id: 3, block_nome: "Almoço", categoria: "proteina", alimento: "Frango" }),
  ];

  it("filtra por refeição e categoria", () => {
    expect(trocasPara(SWAPS, "Café da Manhã", "proteina").map((s) => s.alimento)).toEqual(["Ovos"]);
    expect(trocasPara(SWAPS, "Almoço", "proteina").map((s) => s.alimento)).toEqual(["Frango"]);
  });

  it("casa ignorando acento e caixa", () => {
    // O nome vem digitado à mão em duas abas diferentes da planilha.
    expect(trocasPara(SWAPS, "CAFE DA MANHA", "Proteína")).toHaveLength(1);
  });

  it("item sem categoria não recebe sugestão", () => {
    // Oferecer a troca errada é pior do que não oferecer nenhuma.
    expect(trocasPara(SWAPS, "Café da Manhã", null)).toEqual([]);
  });

  it("devolve vazio quando não há troca para a categoria", () => {
    expect(trocasPara(SWAPS, "Café da Manhã", "vegetal")).toEqual([]);
  });
});

describe("trocasDoBloco", () => {
  it("agrupa por categoria e ordena por caloria", () => {
    const swaps = [
      swap({ id: 1, categoria: "proteina", alimento: "Caro", kcal: 210 }),
      swap({ id: 2, categoria: "proteina", alimento: "Barato", kcal: 70 }),
      swap({ id: 3, categoria: "fruta", alimento: "Banana", kcal: 90 }),
      swap({ id: 4, block_nome: "Janta", categoria: "proteina", alimento: "Peixe" }),
    ];
    const grupos = trocasDoBloco(swaps, "Café da Manhã");

    expect([...grupos.keys()]).toEqual(["proteina", "fruta"]);
    expect(grupos.get("proteina")!.map((s) => s.alimento)).toEqual(["Barato", "Caro"]);
    expect(grupos.get("fruta")).toHaveLength(1);
  });

  it("devolve mapa vazio para bloco sem trocas", () => {
    expect(trocasDoBloco([], "Almoço").size).toBe(0);
  });
});
