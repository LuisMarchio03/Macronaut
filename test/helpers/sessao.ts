import type { Client } from "@libsql/client";
import { criarSessao, iniciarSessao, type ItemPlanejado } from "../../src/repositories/sessao";

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
