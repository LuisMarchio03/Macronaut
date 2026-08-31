import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import {
  VALIDADE_CODIGO_MIN,
  apagarDispositivo,
  criarCodigo,
  dispositivoAtivo,
  listarDispositivos,
  marcarVisto,
  resgatarCodigo,
} from "./dispositivos";

const USER = 1;
const OUTRO = 2;
const AGORA = new Date("2026-08-31T10:00:00.000Z");
const depois = (min: number) => new Date(AGORA.getTime() + min * 60_000);
const APARELHO = { nome: "Galaxy S24", plataforma: "android" };

let db: Client;

beforeEach(async () => {
  db = await createTestDb();
  await db.executeMultiple(`
    INSERT INTO users (email, password_hash, created_at) VALUES ('a@x.com', 'h', 't');
    INSERT INTO users (email, password_hash, created_at) VALUES ('b@x.com', 'h', 't');
  `);
});

describe("código de pareamento", () => {
  it("o código válido vira um dispositivo do dono", async () => {
    await criarCodigo(db, USER, "hash-1", AGORA);

    const r = await resgatarCodigo(db, "hash-1", APARELHO, depois(1));

    expect(r?.userId).toBe(USER);
    expect(r?.deviceId).toBeGreaterThan(0);
    const ds = await listarDispositivos(db, USER);
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ nome: "Galaxy S24", plataforma: "android", visto_em: null });
  });

  it("vale uma vez só", async () => {
    // Sem isto, o código repassado (print, foto do WhatsApp) parearia um
    // segundo aparelho sem ninguém notar.
    await criarCodigo(db, USER, "hash-1", AGORA);
    expect(await resgatarCodigo(db, "hash-1", APARELHO, depois(1))).not.toBeNull();
    expect(await resgatarCodigo(db, "hash-1", APARELHO, depois(2))).toBeNull();
    expect(await listarDispositivos(db, USER)).toHaveLength(1);
  });

  it("expira", async () => {
    await criarCodigo(db, USER, "hash-1", AGORA);
    expect(await resgatarCodigo(db, "hash-1", APARELHO, depois(VALIDADE_CODIGO_MIN + 1))).toBeNull();
  });

  it("no limite do prazo ainda vale", async () => {
    await criarCodigo(db, USER, "hash-1", AGORA);
    expect(await resgatarCodigo(db, "hash-1", APARELHO, depois(VALIDADE_CODIGO_MIN - 0.1))).not.toBeNull();
  });

  it("código inexistente não pareia nada", async () => {
    expect(await resgatarCodigo(db, "nunca-existiu", APARELHO, AGORA)).toBeNull();
    expect(await listarDispositivos(db, USER)).toEqual([]);
  });

  it("gerar um novo código invalida o anterior", async () => {
    // A tela mostra um código por vez; três antigos ainda válidos seriam três
    // portas abertas que ninguém vê.
    await criarCodigo(db, USER, "hash-1", AGORA);
    await criarCodigo(db, USER, "hash-2", depois(1));

    expect(await resgatarCodigo(db, "hash-1", APARELHO, depois(2))).toBeNull();
    expect(await resgatarCodigo(db, "hash-2", APARELHO, depois(2))).not.toBeNull();
  });

  it("o código de um usuário não pareia na conta do outro", async () => {
    await criarCodigo(db, OUTRO, "hash-do-outro", AGORA);
    const r = await resgatarCodigo(db, "hash-do-outro", APARELHO, depois(1));

    expect(r?.userId).toBe(OUTRO);
    expect(await listarDispositivos(db, USER)).toEqual([]);
  });
});

describe("dispositivos", () => {
  async function parear(userId: number, nome = "Galaxy S24") {
    await criarCodigo(db, userId, `h-${nome}`, AGORA);
    const r = await resgatarCodigo(db, `h-${nome}`, { nome, plataforma: "android" }, depois(1));
    return r!.deviceId;
  }

  it("apagar é revogar: o token daquele aparelho deixa de valer", async () => {
    const id = await parear(USER);
    expect(await dispositivoAtivo(db, USER, id)).toBe(true);

    await apagarDispositivo(db, USER, id);

    expect(await dispositivoAtivo(db, USER, id)).toBe(false);
    expect(await listarDispositivos(db, USER)).toEqual([]);
  });

  it("não dá para apagar o aparelho de outro usuário", async () => {
    const id = await parear(OUTRO);
    await apagarDispositivo(db, USER, id);
    expect(await dispositivoAtivo(db, OUTRO, id)).toBe(true);
  });

  it("o token de um usuário não vale para o aparelho de outro", async () => {
    const id = await parear(OUTRO);
    expect(await dispositivoAtivo(db, USER, id)).toBe(false);
  });

  it("marcarVisto registra a última sincronização", async () => {
    const id = await parear(USER);
    await marcarVisto(db, id, depois(30));

    expect((await listarDispositivos(db, USER))[0].visto_em).toBe(depois(30).toISOString());
  });

  it("lista do mais recente para o mais antigo", async () => {
    await criarCodigo(db, USER, "a", AGORA);
    await resgatarCodigo(db, "a", { nome: "Velho", plataforma: "android" }, depois(1));
    await criarCodigo(db, USER, "b", depois(2));
    await resgatarCodigo(db, "b", { nome: "Novo", plataforma: "android" }, depois(3));

    expect((await listarDispositivos(db, USER)).map((d) => d.nome)).toEqual(["Novo", "Velho"]);
  });
});
