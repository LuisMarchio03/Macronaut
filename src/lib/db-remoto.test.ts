import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { criarBancoRemoto } from "./db-remoto";
import { traduzirErro } from "../domain/erros";
import { isAuthError } from "./query-client";

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const RESULTADO = {
  columns: ["id", "nome"],
  rows: [{ id: 7, nome: "Café" }],
  rowsAffected: 0,
  lastInsertRowid: null,
};

describe("execute", () => {
  it("manda o SQL e o token, e devolve as linhas por nome", async () => {
    fetchMock.mockResolvedValue(resposta(RESULTADO));
    const db = criarBancoRemoto("tok-123");

    const rs = await db.execute({ sql: "SELECT id, nome FROM meals WHERE id=?", args: [7] });

    expect(rs.rows).toEqual([{ id: 7, nome: "Café" }]);
    const [rota, init] = fetchMock.mock.calls[0];
    expect(rota).toBe("/api/db");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
    expect(JSON.parse(init.body)).toEqual({
      tipo: "execute",
      comando: { sql: "SELECT id, nome FROM meals WHERE id=?", args: [7] },
    });
  });

  it("aceita SQL como string simples, que o app também usa", async () => {
    fetchMock.mockResolvedValue(resposta(RESULTADO));
    await criarBancoRemoto("t").execute("SELECT 1");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).comando).toEqual({ sql: "SELECT 1" });
  });

  it("lastInsertRowid volta como bigint, e Number() sobre ele dá o id", async () => {
    // Meia dúzia de repositórios faz `Number(rs.lastInsertRowid)` para saber o
    // id do que acabou de criar. Se isso não atravessar, toda criação devolve
    // um id inutilizável.
    fetchMock.mockResolvedValue(resposta({ ...RESULTADO, rowsAffected: 1, lastInsertRowid: "42" }));
    const rs = await criarBancoRemoto("t").execute("INSERT INTO meals DEFAULT VALUES");

    expect(typeof rs.lastInsertRowid).toBe("bigint");
    expect(Number(rs.lastInsertRowid)).toBe(42);
  });

  it("sem lastInsertRowid vira undefined, como no libsql", async () => {
    fetchMock.mockResolvedValue(resposta(RESULTADO));
    const rs = await criarBancoRemoto("t").execute("SELECT 1");
    expect(rs.lastInsertRowid).toBeUndefined();
  });
});

describe("batch", () => {
  it("vai numa requisição só, com o modo", async () => {
    // É o que segura a latência: um batch de 12 comandos é 1 ida ao servidor,
    // não 12.
    fetchMock.mockResolvedValue(resposta([RESULTADO, RESULTADO]));
    const db = criarBancoRemoto("t");

    const rs = await db.batch([{ sql: "A" }, { sql: "B", args: [1] }], "write");

    expect(rs).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      tipo: "batch",
      comandos: [{ sql: "A" }, { sql: "B", args: [1] }],
      modo: "write",
    });
  });
});

describe("erros", () => {
  it("401 vira erro que a máquina de logout reconhece", async () => {
    fetchMock.mockResolvedValue(resposta({ error: "401 sessão inválida" }, 401));
    const db = criarBancoRemoto("t");

    const erro = await db.execute("SELECT 1").catch((e: unknown) => e);
    expect(isAuthError(erro)).toBe(true);
    expect(traduzirErro(erro).titulo).toMatch(/sessão expirou/i);
  });

  it("erro de SQL chega inteiro, para a tela dizer o que fazer", async () => {
    // `traduzirErro` lê a mensagem crua para reconhecer banco desatualizado.
    // Reembrulhar num "erro no servidor" apagaria essa pista.
    fetchMock.mockResolvedValue(
      resposta({ error: "SQLITE_UNKNOWN: no such table: plan_item_swaps" }, 400),
    );
    const erro = await criarBancoRemoto("t").execute("SELECT 1").catch((e: unknown) => e);

    expect(traduzirErro(erro).titulo).toMatch(/falta a tabela "plan_item_swaps"/);
    expect(traduzirErro(erro).acao).toMatch(/db:setup/);
  });

  it("resposta sem JSON ainda vira um erro com o status", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    const erro = (await criarBancoRemoto("t").execute("SELECT 1").catch((e: unknown) => e)) as Error;
    expect(erro.message).toContain("502");
  });

  it("rede fora sobe como está, e a tela sabe traduzir", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const erro = await criarBancoRemoto("t").execute("SELECT 1").catch((e: unknown) => e);
    expect(traduzirErro(erro).titulo).toMatch(/não consegui falar com o banco/i);
  });
});

describe("o que não atravessa o proxy", () => {
  it("executeMultiple e transaction explicam por que não existem", () => {
    const db = criarBancoRemoto("t");
    expect(() => db.executeMultiple("SELECT 1")).toThrow(/executeMultiple não existe/);
    expect(() => db.transaction()).toThrow(/transaction não existe/);
  });

  it("close é inofensivo: não há conexão para fechar", () => {
    expect(() => criarBancoRemoto("t").close()).not.toThrow();
  });
});
