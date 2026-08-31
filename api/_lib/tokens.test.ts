import { describe, it, expect } from "vitest";
import {
  DURACAO_SESSAO_S,
  SEM_EXPIRACAO,
  emitir,
  gerarCodigo,
  hashDeCodigo,
  normalizarCodigo,
  verificar,
  type Payload,
} from "./tokens";

const SEGREDO = "segredo-de-teste";
const AGORA = 1_800_000_000;

const sessao = (over: Partial<Payload> = {}): Payload => ({
  u: 3,
  exp: AGORA + DURACAO_SESSAO_S,
  esc: "sessao",
  ...over,
});

describe("emitir e verificar", () => {
  it("o token emitido volta com o mesmo payload", () => {
    const t = emitir(sessao(), SEGREDO);
    expect(verificar(t, SEGREDO, "sessao", AGORA)).toEqual(sessao());
  });

  it("segredo diferente não valida", () => {
    const t = emitir(sessao(), SEGREDO);
    expect(verificar(t, "outro-segredo", "sessao", AGORA)).toBeNull();
  });

  it("payload adulterado não valida", () => {
    // Trocar o usuário no corpo sem poder reassinar é o ataque óbvio.
    const t = emitir(sessao(), SEGREDO);
    const assinatura = t.split(".")[1];
    const adulterado = Buffer.from(
      JSON.stringify({ ...sessao(), u: 999 }),
      "utf-8",
    ).toString("base64url");
    expect(verificar(`${adulterado}.${assinatura}`, SEGREDO, "sessao", AGORA)).toBeNull();
  });

  it("token vencido não valida", () => {
    const t = emitir(sessao({ exp: AGORA - 1 }), SEGREDO);
    expect(verificar(t, SEGREDO, "sessao", AGORA)).toBeNull();
  });

  it("expiração exatamente agora já venceu", () => {
    const t = emitir(sessao({ exp: AGORA }), SEGREDO);
    expect(verificar(t, SEGREDO, "sessao", AGORA)).toBeNull();
  });

  it("um token de dispositivo NÃO abre uma rota de sessão", () => {
    // É o que impede o celular de virar um console de SQL: `/api/db` só aceita
    // escopo de sessão, e o APK só tem o de dispositivo.
    const t = emitir({ u: 3, exp: SEM_EXPIRACAO, esc: "dispositivo", d: 1 }, SEGREDO);
    expect(verificar(t, SEGREDO, "sessao", AGORA)).toBeNull();
    expect(verificar(t, SEGREDO, "dispositivo", AGORA)).toMatchObject({ u: 3, d: 1 });
  });

  it("token de dispositivo não expira por tempo", () => {
    const t = emitir({ u: 3, exp: SEM_EXPIRACAO, esc: "dispositivo", d: 1 }, SEGREDO);
    expect(verificar(t, SEGREDO, "dispositivo", AGORA + 100 * 365 * 24 * 3600)).not.toBeNull();
  });

  it("lixo não derruba a verificação", () => {
    for (const t of ["", ".", "abc", "a.b.c", "não-é-base64.xxx", "eyJ1IjozfQ"]) {
      expect(verificar(t, SEGREDO, "sessao", AGORA)).toBeNull();
    }
  });
});

describe("código de pareamento", () => {
  it("tem o formato que se digita: XXXX-XXXX", () => {
    expect(gerarCodigo()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("não usa os caracteres que a pessoa confunde", () => {
    // I/1 e O/0 são o motivo de código digitado errado.
    const amostra = Array.from({ length: 200 }, gerarCodigo).join("");
    expect(amostra).not.toMatch(/[IO01]/);
  });

  it("dois códigos seguidos não se repetem", () => {
    const cem = new Set(Array.from({ length: 100 }, gerarCodigo));
    expect(cem.size).toBe(100);
  });

  it("normaliza o que a pessoa digita", () => {
    expect(normalizarCodigo("k7p2-9xmr")).toBe("K7P29XMR");
    expect(normalizarCodigo(" K7P2 9XMR ")).toBe("K7P29XMR");
  });

  it("o hash casa independente de como foi digitado", () => {
    const codigo = "K7P2-9XMR";
    expect(hashDeCodigo("k7p2 9xmr", SEGREDO)).toBe(hashDeCodigo(codigo, SEGREDO));
  });

  it("o hash não devolve o código", () => {
    const h = hashDeCodigo("K7P2-9XMR", SEGREDO);
    expect(h).not.toContain("K7P2");
    expect(h.length).toBeGreaterThan(20);
  });
});
