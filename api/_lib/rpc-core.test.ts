import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  ChamadaInvalida,
  LIMITE_CHAMADAS,
  OperacaoDesconhecida,
  executar,
  executarLote,
  lerChamadas,
  type Registro,
} from "./rpc-core";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
});

/** Um registro de mentira, para o núcleo ser testado sem repositório junto. */
const espiao = vi.fn();
const REGISTRO: Registro = {
  "teste.doUsuario": {
    escopo: "usuario",
    fn: (async (_db: Client, userId: number, a?: number) => {
      espiao(userId, a);
      return { userId, a };
    }) as Registro[string]["fn"],
  },
  "teste.global": {
    escopo: "global",
    fn: (async (_db: Client, a?: number) => ({ a })) as Registro[string]["fn"],
  },
  "teste.explode": {
    escopo: "usuario",
    fn: (async () => {
      throw new Error("SQLITE_UNKNOWN: no such table: xis");
    }) as Registro[string]["fn"],
  },
  "teste.vazio": {
    escopo: "usuario",
    fn: (async () => undefined) as Registro[string]["fn"],
  },
};

describe("lerChamadas", () => {
  it("aceita um lote bem formado", () => {
    expect(lerChamadas({ chamadas: [{ nome: "a", args: [1] }, { nome: "b" }] })).toEqual([
      { nome: "a", args: [1] },
      { nome: "b", args: [] },
    ]);
  });

  it("recusa o que não é lote", () => {
    for (const c of [null, "x", {}, { chamadas: [] }, { chamadas: [{}] }]) {
      expect(() => lerChamadas(c)).toThrow(ChamadaInvalida);
    }
  });

  it("recusa lote gigante", () => {
    const muitas = Array.from({ length: LIMITE_CHAMADAS + 1 }, () => ({ nome: "a" }));
    expect(() => lerChamadas({ chamadas: muitas })).toThrow(/acima de/);
  });
});

describe("executar", () => {
  it("o userId vem do TOKEN, não dos argumentos", async () => {
    // É a razão de o registro existir. O cliente não tem como dizer de quem é
    // a linha que quer ler.
    espiao.mockClear();
    const r = await executar(REGISTRO, db, 7, { nome: "teste.doUsuario", args: [42] });

    expect(r).toEqual({ userId: 7, a: 42 });
    expect(espiao).toHaveBeenCalledWith(7, 42);
  });

  it("um userId forjado nos argumentos é empurrado para a frente, nunca substitui", async () => {
    // O cliente manda `[99]` querendo ser o usuário 99; ele chega como o
    // PRIMEIRO argumento da função, depois do userId real.
    espiao.mockClear();
    await executar(REGISTRO, db, 7, { nome: "teste.doUsuario", args: [99] });
    expect(espiao).toHaveBeenCalledWith(7, 99);
  });

  it("operação global não recebe userId", async () => {
    expect(await executar(REGISTRO, db, 7, { nome: "teste.global", args: [5] })).toEqual({ a: 5 });
  });

  it("nome fora do registro é recusado", async () => {
    await expect(
      executar(REGISTRO, db, 7, { nome: "teste.naoExiste", args: [] }),
    ).rejects.toThrow(OperacaoDesconhecida);
  });

  it("nome herdado do protótipo NÃO é despachado", async () => {
    // `registro["toString"]` acharia um método do Object. Sem `Object.hasOwn`
    // o despacho tentaria chamá-lo — e o cliente escolhe o nome.
    for (const nome of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      await expect(executar(REGISTRO, db, 7, { nome, args: [] })).rejects.toThrow(
        OperacaoDesconhecida,
      );
    }
  });

  it("undefined vira null — JSON não carrega undefined", async () => {
    expect(await executar(REGISTRO, db, 7, { nome: "teste.vazio", args: [] })).toBeNull();
  });
});

describe("executarLote", () => {
  it("devolve um resultado por chamada, na ordem", async () => {
    const r = await executarLote(REGISTRO, db, 7, [
      { nome: "teste.doUsuario", args: [1] },
      { nome: "teste.global", args: [2] },
    ]);
    expect(r).toEqual([
      { ok: true, valor: { userId: 7, a: 1 } },
      { ok: true, valor: { a: 2 } },
    ]);
  });

  it("uma chamada que falha NÃO derruba as outras", async () => {
    // Quando cada consulta era uma requisição, uma ruim derrubava só a si
    // mesma. Perder essa isolação seria trocar latência por fragilidade.
    const r = await executarLote(REGISTRO, db, 7, [
      { nome: "teste.doUsuario", args: [1] },
      { nome: "teste.explode", args: [] },
      { nome: "teste.global", args: [2] },
    ]);

    expect(r[0].ok).toBe(true);
    expect(r[1]).toEqual({ ok: false, erro: "SQLITE_UNKNOWN: no such table: xis" });
    expect(r[2].ok).toBe(true);
  });

  it("operação desconhecida falha só ela", async () => {
    const r = await executarLote(REGISTRO, db, 7, [
      { nome: "teste.naoExiste", args: [] },
      { nome: "teste.global", args: [] },
    ]);
    expect(r[0]).toMatchObject({ ok: false });
    expect(r[1].ok).toBe(true);
  });

  it("a mensagem do banco atravessa inteira, para a tela saber traduzir", async () => {
    const [r] = await executarLote(REGISTRO, db, 7, [{ nome: "teste.explode", args: [] }]);
    expect(r).toMatchObject({ ok: false });
    expect((r as { erro: string }).erro).toMatch(/no such table: xis/);
  });
});

/* ══════════════════════════════════════════════════════════════════
   A PROPRIEDADE QUE MOTIVOU O REGISTRO

   Com `/api/db`, uma sessão válida manda SQL e alcança a linha de qualquer
   usuário. Aqui não há SQL a mandar, e o dono vem do token.
   ══════════════════════════════════════════════════════════════════ */

describe("isolamento entre usuários, pelo registro de verdade", () => {
  it("a sessão de um usuário não enxerga a rotina do outro", async () => {
    const { REGISTRO } = await import("./registro");
    const { criarRotina, salvarDia } = await import("../../src/repositories/rotina");

    // O usuário 2 tem uma rotina com um dia.
    const alheia = await criarRotina(db, 2, "Rotina do outro");
    await salvarDia(db, 2, alheia.id, 1, "Peito do outro");

    // O usuário 7 pede a rotina ativa: recebe a DELE (nenhuma).
    expect(await executar(REGISTRO, db, 7, { nome: "rotina.getRotinaAtiva", args: [] })).toBeNull();

    // E pedindo os dias da rotina alheia PELO ID, recebe lista vazia — o
    // `WHERE user_id` do repositório é alimentado pelo token, não pelo pedido.
    expect(
      await executar(REGISTRO, db, 7, { nome: "rotina.listDias", args: [alheia.id] }),
    ).toEqual([]);
  });

  it("escrever na rotina alheia pelo id não faz nada", async () => {
    const { REGISTRO } = await import("./registro");
    const { criarRotina, salvarDia, listDias } = await import("../../src/repositories/rotina");

    const alheia = await criarRotina(db, 2, "Rotina do outro");
    await salvarDia(db, 2, alheia.id, 1, "Original");

    await expect(
      executar(REGISTRO, db, 7, {
        nome: "rotina.salvarDia",
        args: [alheia.id, 1, "Invadido"],
      }),
    ).rejects.toThrow(/rotina não encontrada/);

    expect((await listDias(db, 2, alheia.id))[0].nome).toBe("Original");
  });
});

describe("Map atravessa o JSON", () => {
  it("um Map volta como Map, não como {}", async () => {
    // Sete repositórios devolvem `Map`. Pelo `/api/db` isso não aparecia — o
    // mapa era montado no cliente, a partir das linhas. Aqui ele é montado no
    // servidor, e `JSON.stringify(new Map([[1,'a']]))` é `{}`.
    const reg: Registro = {
      "t.mapa": {
        escopo: "usuario",
        fn: (async () => new Map([[1, "a"], [2, "b"]])) as Registro[string]["fn"],
      },
    };
    const [r] = await executarLote(reg, db, 1, [{ nome: "t.mapa", args: [] }]);

    expect(r).toMatchObject({ ok: true });
    const cru = JSON.parse(JSON.stringify((r as { valor: unknown }).valor));
    expect(cru).toEqual({ __mapa: [[1, "a"], [2, "b"]] });
  });

  it("Map aninhado dentro de objeto e de lista também", async () => {
    const reg: Registro = {
      "t.aninhado": {
        escopo: "usuario",
        fn: (async () => ({ lista: [new Map([["x", 1]])], solto: new Map() })) as Registro[string]["fn"],
      },
    };
    const [r] = await executarLote(reg, db, 1, [{ nome: "t.aninhado", args: [] }]);
    const v = (r as { valor: { lista: unknown[]; solto: unknown } }).valor;

    expect(v.lista[0]).toEqual({ __mapa: [["x", 1]] });
    expect(v.solto).toEqual({ __mapa: [] });
  });

  it("objeto comum não vira mapa por engano", async () => {
    const reg: Registro = {
      "t.objeto": {
        escopo: "usuario",
        fn: (async () => ({ id: 1, nome: "Café", nulo: null })) as Registro[string]["fn"],
      },
    };
    const [r] = await executarLote(reg, db, 1, [{ nome: "t.objeto", args: [] }]);
    expect((r as { valor: unknown }).valor).toEqual({ id: 1, nome: "Café", nulo: null });
  });
});
