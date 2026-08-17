import type { Client } from "@libsql/client";

/**
 * Os exercícios de cardio do catálogo, semeados a partir de `activity_types`.
 *
 * Cardio é um exercício aqui de propósito: a tela da sessão renderiza UMA
 * lista ordenada — supino, bike, rosca, na ordem em que você faz — e uma
 * tabela paralela de itens de cardio obrigaria toda leitura do plano a virar
 * um merge de duas listas para desenhar uma.
 *
 * Idempotente: reconhece o que já existe pelo nome e pelo equipamento.
 */
export async function seedExerciciosDeCardio(db: Client): Promise<number> {
  const tipos = await db.execute("SELECT nome, met FROM activity_types ORDER BY id");
  if (tipos.rows.length === 0) return 0;

  const jaExistem = await db.execute(
    "SELECT nome FROM exercises WHERE equipamento = 'cardio' AND user_id IS NULL",
  );
  const conhecidos = new Set(jaExistem.rows.map((r) => r.nome as string));

  const novos = tipos.rows.filter((r) => !conhecidos.has(r.nome as string));
  if (novos.length === 0) return 0;

  const created_at = new Date().toISOString();
  await db.batch(
    novos.map((r) => ({
      sql: `INSERT INTO exercises (user_id, nome, source, tipo, equipamento, met, created_at)
            VALUES (NULL, ?, 'catalogo', NULL, 'cardio', ?, ?)`,
      args: [r.nome as string, r.met as number, created_at],
    })),
    "write",
  );
  return novos.length;
}
