import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Tokens assinados pelo servidor.
 *
 * Até aqui o "token de sessão" do app ERA o token do Turso: o navegador
 * recebia a credencial do banco e falava direto com ele. Quem tivesse a
 * sessão tinha o banco inteiro, para sempre e fora do app — e não havia como
 * revogar sem trocar o token de todo mundo.
 *
 * Estes tokens não dão acesso a nada por si: são um bilhete assinado que diz
 * "sou o usuário 3, até tal hora, para tal finalidade". Quem valida é o
 * servidor, que é o único que ainda conhece o Turso.
 *
 * HMAC e não JWT: o payload é um objeto de três campos, o consumidor é este
 * mesmo servidor, e uma dependência a mais para carregar um `alg: none` no
 * currículo não paga.
 */

/** Para que o bilhete serve. Um token de dispositivo NÃO abre `/api/db`. */
export type Escopo = "sessao" | "dispositivo";

export interface Payload {
  /** `users.id`. */
  u: number;
  /** Expiração, em segundos desde a época. */
  exp: number;
  esc: Escopo;
  /** `devices.id`, só no escopo de dispositivo — é o que permite revogar um. */
  d?: number;
}

/** Uma sessão de navegador dura 30 dias; depois disso, login de novo. */
export const DURACAO_SESSAO_S = 30 * 24 * 60 * 60;

/**
 * O token do celular não expira por tempo.
 *
 * Um relógio que sincroniza em segundo plano não tem como pedir a senha de
 * novo, e um token que morre no meio da noite viraria "o app parou de
 * sincronizar" sem nenhuma pista. A revogação existe, e é explícita: apagar o
 * dispositivo na tela de ajustes.
 */
export const SEM_EXPIRACAO = 0;

function base64url(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function assinar(dados: string, segredo: string): string {
  return base64url(createHmac("sha256", segredo).update(dados).digest());
}

export function emitir(payload: Payload, segredo: string): string {
  const corpo = base64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  return `${corpo}.${assinar(corpo, segredo)}`;
}

/**
 * Devolve o payload, ou `null` para qualquer coisa que não seja um token
 * íntegro, no prazo e do escopo pedido.
 *
 * Um `null` só, sem dizer o motivo: para quem está tentando adivinhar, "sua
 * assinatura está errada" e "seu token venceu" são duas informações.
 */
export function verificar(
  token: string,
  segredo: string,
  escopo: Escopo,
  agoraS: number = Math.floor(Date.now() / 1000),
): Payload | null {
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [corpo, assinatura] = partes;

  const esperada = Buffer.from(assinar(corpo, segredo), "utf-8");
  const recebida = Buffer.from(assinatura, "utf-8");
  // `timingSafeEqual` explode com tamanhos diferentes, e o tamanho de um HMAC
  // é fixo — então divergir aqui já é assinatura inválida.
  if (esperada.length !== recebida.length) return null;
  if (!timingSafeEqual(esperada, recebida)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(deBase64url(corpo).toString("utf-8")) as Payload;
  } catch {
    return null;
  }

  if (typeof payload.u !== "number" || payload.esc !== escopo) return null;
  if (payload.exp !== SEM_EXPIRACAO && payload.exp <= agoraS) return null;
  return payload;
}

/* ── código de pareamento ────────────────────────────────────────── */

/**
 * Sem I, O, 0 e 1: o código é lido numa tela e digitado noutra, e essas quatro
 * são as que a pessoa erra.
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** "K7P2-9XMR" — oito caracteres, hifenizados para caber no olho. */
export function gerarCodigo(): string {
  const bytes = randomBytes(8);
  const cru = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return `${cru.slice(0, 4)}-${cru.slice(4)}`;
}

export function normalizarCodigo(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * O que vai para o banco é o hash, nunca o código.
 *
 * O código é curto o bastante para ser digitado, então é curto o bastante para
 * ser adivinhado — o que o protege é durar cinco minutos e valer uma vez só.
 * Guardar o hash garante que um vazamento da tabela não entregue códigos
 * ainda válidos.
 */
export function hashDeCodigo(codigo: string, segredo: string): string {
  return assinar(normalizarCodigo(codigo), segredo);
}
