import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { criarBancoRemoto } from "./db-remoto";
import { traduzirErro } from "../domain/erros";
import { isAuthError } from "./query-client";

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Uma `Response` NOVA a cada chamada.
 *
 * `mockResolvedValue(resposta(...))` devolve o mesmo objeto sempre, e o corpo
 * de uma `Response` só pode ser lido uma vez — o segundo `fetch` do teste
 * estourava "Body has already been read", que é defeito do teste e não do
 * código.
 */
const sempre = (corpo: unknown, status = 200) => () => resposta(corpo, status);

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

/* ══════════════════════════════════════════════════════════════════
   JUNÇÃO DAS LEITURAS

   Abrir o dashboard disparava 16 requisições — cada hook chama `execute` uma
   vez, e cada uma era uma ida ao servidor que fazia outra ida ao Turso. Todas
   saem no mesmo tique do laço de eventos, e é só isso que a fila explora.
   ══════════════════════════════════════════════════════════════════ */

describe("junção das leituras", () => {
  it("leituras disparadas no mesmo tique viram UMA requisição", async () => {
    fetchMock.mockResolvedValue(resposta([RESULTADO, RESULTADO, RESULTADO]));
    const db = criarBancoRemoto("t");

    const rs = await Promise.all([
      db.execute("SELECT 1"),
      db.execute({ sql: "SELECT * FROM meals WHERE user_id=?", args: [3] }),
      db.execute("SELECT 3"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.tipo).toBe("batch");
    expect(corpo.comandos).toHaveLength(3);
    expect(rs).toHaveLength(3);
    expect(rs[0].rows).toEqual([{ id: 7, nome: "Café" }]);
  });

  it("cada consulta recebe o SEU resultado, na ordem", async () => {
    fetchMock.mockResolvedValue(
      resposta([
        { ...RESULTADO, rows: [{ id: 1, nome: "A" }] },
        { ...RESULTADO, rows: [{ id: 2, nome: "B" }] },
      ]),
    );
    const db = criarBancoRemoto("t");

    const [a, b] = await Promise.all([db.execute("SELECT a"), db.execute("SELECT b")]);

    expect(a.rows[0].nome).toBe("A");
    expect(b.rows[0].nome).toBe("B");
  });

  it("o lote sai em modo read — a segunda defesa contra escrita juntada", async () => {
    fetchMock.mockResolvedValue(resposta([RESULTADO, RESULTADO]));
    const db = criarBancoRemoto("t");
    await Promise.all([db.execute("SELECT 1"), db.execute("SELECT 2")]);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).modo).toBe("read");
  });

  it("uma leitura sozinha continua sendo um execute simples", async () => {
    fetchMock.mockResolvedValue(resposta(RESULTADO));
    await criarBancoRemoto("t").execute("SELECT 1");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tipo).toBe("execute");
  });

  it("ESCRITA nunca é juntada: vai sozinha e na hora", async () => {
    // Um `batch` do libsql é transacional. Juntar escritas independentes faria
    // uma falhar e desfazer as outras — comportamento que elas não tinham.
    fetchMock.mockImplementation(sempre(RESULTADO));
    const db = criarBancoRemoto("t");

    await Promise.all([
      db.execute("INSERT INTO meals (nome) VALUES ('x')"),
      db.execute("UPDATE meals SET nome='y'"),
      db.execute("DELETE FROM meals"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const c of fetchMock.mock.calls) expect(JSON.parse(c[1].body).tipo).toBe("execute");
  });

  it("SELECT com palavra de escrita dentro não é juntado", async () => {
    // Conservador de propósito: um falso negativo custa uma requisição a mais,
    // um falso positivo custaria uma escrita dentro de transação alheia.
    fetchMock.mockResolvedValue(resposta(RESULTADO));
    const db = criarBancoRemoto("t");
    await db.execute("SELECT * FROM x WHERE nome = 'DELETE'");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tipo).toBe("execute");
  });

  it("leitura e escrita no mesmo tique não se misturam", async () => {
    fetchMock.mockImplementation(sempre(RESULTADO));
    const db = criarBancoRemoto("t");

    await Promise.all([
      db.execute("SELECT 1"),
      db.execute("INSERT INTO meals (nome) VALUES ('x')"),
    ]);

    // Duas requisições: a escrita saiu na hora, a leitura sozinha virou execute.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const tipos = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).tipo);
    expect(tipos).toEqual(["execute", "execute"]);
  });

  it("consulta que depende da anterior NÃO é juntada — ela precisa esperar", async () => {
    fetchMock.mockImplementation(sempre(RESULTADO));
    const db = criarBancoRemoto("t");

    const primeira = await db.execute("SELECT 1");
    await db.execute(`SELECT * FROM x WHERE id = ${primeira.rows[0].id}`);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lote que falha inteiro é refeito uma a uma, para não derrubar as boas", async () => {
    // É a isolação que existia antes da junção: uma consulta ruim derrubava só
    // a si mesma. Um `batch` transacional derrubaria as três.
    fetchMock
      .mockResolvedValueOnce(resposta({ error: "no such table: xis" }, 400))
      .mockResolvedValueOnce(resposta({ ...RESULTADO, rows: [{ id: 1, nome: "A" }] }))
      .mockResolvedValueOnce(resposta({ error: "no such table: xis" }, 400));

    const db = criarBancoRemoto("t");
    const [boa, ruim] = await Promise.allSettled([
      db.execute("SELECT * FROM meals"),
      db.execute("SELECT * FROM xis"),
    ]);

    expect(boa.status).toBe("fulfilled");
    expect(ruim.status).toBe("rejected");
    expect((ruim as PromiseRejectedResult).reason.message).toContain("no such table: xis");
    // 1 lote que falhou + 2 individuais.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("batch explícito do repositório continua intocado", async () => {
    // `db.batch(...)` já é uma requisição só e tem semântica de transação que
    // o chamador escolheu. A fila não mexe nele.
    fetchMock.mockResolvedValue(resposta([RESULTADO]));
    await criarBancoRemoto("t").batch([{ sql: "INSERT INTO x VALUES (1)" }], "write");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).modo).toBe("write");
  });
});
