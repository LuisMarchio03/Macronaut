import type { Client } from "@libsql/client";

/**
 * O registro de operações: o que o cliente pode pedir ao servidor.
 *
 * Fechou o buraco que `/api/db` era. Lá o cliente mandava SQL, e uma sessão
 * válida rodava qualquer consulta — inclusive nas linhas de outro usuário.
 * Aqui ele manda um NOME e argumentos; quem escolhe a consulta é o servidor, e
 * o `user_id` **vem do token**, nunca do corpo do pedido. Forjar dono deixou
 * de ser possível por construção, não por disciplina.
 *
 * As funções não mudam: os repositórios já são `(db, userId, ...args)`, e é
 * essa forma que permite um despacho de dez linhas em vez de 250 endpoints
 * escritos à mão.
 */

/**
 * De quem é o dado.
 *
 * `usuario` — recebe `userId` do token como segundo argumento.
 * `global`  — catálogo que não pertence a ninguém (TACO, medidas da POF,
 *             tipos de atividade, grupos musculares). Não recebe `userId`
 *             porque não há dono a filtrar.
 *
 * Marcar de global o que é de alguém é como declarar a linha pública. Por isso
 * o padrão é `usuario`: uma entrada nova sem escopo declarado não compila.
 */
export type Escopo = "usuario" | "global";

export interface Operacao {
  escopo: Escopo;
  fn: (...args: never[]) => Promise<unknown>;
}

export type Registro = Record<string, Operacao>;

export class ChamadaInvalida extends Error {}
export class OperacaoDesconhecida extends Error {}

export interface Chamada {
  nome: string;
  args: unknown[];
}

/** Um lote de chamadas: os hooks disparam juntos, então vão juntos. */
export const LIMITE_CHAMADAS = 100;

export function lerChamadas(corpo: unknown): Chamada[] {
  if (typeof corpo !== "object" || corpo === null) throw new ChamadaInvalida("corpo ausente");
  const c = corpo as Record<string, unknown>;
  const cru = c.chamadas;
  if (!Array.isArray(cru)) throw new ChamadaInvalida("chamadas deve ser uma lista");
  if (cru.length === 0) throw new ChamadaInvalida("nenhuma chamada");
  if (cru.length > LIMITE_CHAMADAS) {
    throw new ChamadaInvalida(`acima de ${LIMITE_CHAMADAS} chamadas`);
  }

  return cru.map((x) => {
    const o = x as Record<string, unknown>;
    if (typeof o.nome !== "string" || o.nome === "") throw new ChamadaInvalida("nome ausente");
    if (o.args !== undefined && !Array.isArray(o.args)) {
      throw new ChamadaInvalida("args deve ser uma lista");
    }
    return { nome: o.nome, args: (o.args as unknown[]) ?? [] };
  });
}

/** O que uma chamada devolve: o valor, ou o erro dela — nunca os dois. */
export type Resultado = { ok: true; valor: unknown } | { ok: false; erro: string };

/**
 * `Map` não sobrevive a JSON — vira `{}`, calado.
 *
 * Sete funções de repositório devolvem `Map` (`getFoodsByIds`,
 * `listItensPorBloco`, `aguaPorBloco`…). Pelo `/api/db` isso não aparecia
 * porque o mapa era montado no cliente, a partir das linhas. Agora ele é
 * montado no servidor e precisa atravessar.
 *
 * A marca é um objeto com uma chave improvável, e não um formato posicional:
 * um `Map` de verdade e um objeto que por acaso tem `entradas` precisam ser
 * distinguíveis, e `__mapa` é o tipo de chave que ninguém escreve sem querer.
 */
const MARCA_MAPA = "__mapa";

export function serializarValor(v: unknown): unknown {
  if (v instanceof Map) {
    return { [MARCA_MAPA]: [...v.entries()].map(([k, x]) => [k, serializarValor(x)]) };
  }
  if (Array.isArray(v)) return v.map(serializarValor);
  // `null` é objeto, e Date já vai como string pelo próprio JSON.
  if (v !== null && typeof v === "object" && !(v instanceof Date)) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, serializarValor(x)]),
    );
  }
  return v;
}

/**
 * Executa uma chamada.
 *
 * `userId` entra aqui, do token. O argumento equivalente que o cliente
 * porventura tenha mandado é ignorado — não há caminho pelo qual ele chegue à
 * função.
 */
export async function executar(
  registro: Registro,
  db: Client,
  userId: number,
  chamada: Chamada,
): Promise<unknown> {
  // `Object.hasOwn` e não `registro[nome]`: sem isso, `nome: "toString"` acha
  // um método do protótipo e o despacho tenta chamá-lo.
  if (!Object.hasOwn(registro, chamada.nome)) {
    throw new OperacaoDesconhecida(`operação desconhecida: ${chamada.nome}`);
  }
  const op = registro[chamada.nome];
  const args = op.escopo === "usuario" ? [db, userId, ...chamada.args] : [db, ...chamada.args];
  return (await (op.fn as (...a: unknown[]) => Promise<unknown>)(...args)) ?? null;
}

/**
 * Executa o lote e devolve um resultado por chamada, na ordem.
 *
 * Uma chamada que falha NÃO derruba as outras: cada uma volta com o seu erro.
 * É a mesma isolação que o cliente tinha quando cada consulta era uma
 * requisição — perdê-la seria trocar latência por fragilidade.
 */
export async function executarLote(
  registro: Registro,
  db: Client,
  userId: number,
  chamadas: Chamada[],
): Promise<Resultado[]> {
  return Promise.all(
    chamadas.map(async (c): Promise<Resultado> => {
      try {
        return { ok: true, valor: serializarValor(await executar(registro, db, userId, c)) };
      } catch (e) {
        // A mensagem do banco volta inteira: é dela que a tela tira "falta a
        // tabela X, rode db:setup".
        return { ok: false, erro: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}
