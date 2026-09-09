import type { Client } from "@libsql/client";
import { criarSessao, finalizarSessao, iniciarSessao, type ItemPlanejado } from "../../src/repositories/sessao";
import { createSession, getSession } from "../../src/repositories/workouts";
import type { WorkoutSession } from "../../src/domain/types";

/**
 * Uma sessão já acontecendo.
 *
 * Criar e iniciar viraram dois eventos, e entre eles mora o rascunho. Os
 * testes escritos antes dessa separação falam quase todos sobre um treino EM
 * CURSO — repetir o par nos cinco arquivos espalharia a mesma decisão por
 * todos eles, e a próxima mudança no ciclo de vida teria cinco lugares para
 * passar.
 */
export async function sessaoEmCurso(
  db: Client,
  userId: number,
  entrada: { data: string; nome: string | null; itens: ItemPlanejado[] },
): Promise<number> {
  const id = await criarSessao(db, userId, entrada);
  await iniciarSessao(db, userId, id);
  return id;
}

/**
 * Uma sessão já terminada — é isto, e só isto, que o histórico mostra.
 *
 * `createSession` sozinha devolve um rascunho desde que criar deixou de ser
 * começar, e um rascunho não aparece em `listSessions`, `listSessionsByRange`
 * nem `sessoesComResumo`. Os testes de histórico precisam do fim explícito.
 */
export async function sessaoConcluida(
  db: Client,
  userId: number,
  entrada: { data: string; nome: string | null },
): Promise<WorkoutSession> {
  const s = await createSession(db, userId, entrada);
  await finalizarSessao(db, userId, s.id);
  return (await getSession(db, userId, s.id))!;
}
