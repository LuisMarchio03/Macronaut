import type { Client, Row } from "@libsql/client";
import type { Cadeia, MuscleGroup, Regiao } from "../domain/types";
import { GRUPOS } from "../db/catalogo-exercicios.ts";

function mapRow(r: Row): MuscleGroup {
  return {
    id: r.id as number,
    nome: r.nome as string,
    regiao: r.regiao as Regiao,
    cadeia: (r.cadeia as Cadeia | null) ?? null,
  };
}

export async function listMuscleGroups(db: Client): Promise<MuscleGroup[]> {
  const rs = await db.execute("SELECT * FROM muscle_groups ORDER BY id");
  return rs.rows.map(mapRow);
}

/**
 * Upsert por `nome` (UNIQUE). NUNCA `INSERT OR REPLACE`: isso faz DELETE+INSERT
 * e gera um rowid novo — `exercises.grupo_id` referencia `muscle_groups.id`, então
 * trocar o id deixaria exercícios apontando para grupos inexistentes. `ON
 * CONFLICT ... DO UPDATE` preserva o id e ainda propaga mudança futura de
 * `regiao`/`cadeia` (ex.: uma correção na Fase 3), em vez de deixar dado velho
 * calado no banco do usuário.
 */
export async function seedMuscleGroups(db: Client): Promise<void> {
  await db.batch(
    GRUPOS.map((g) => ({
      sql: `INSERT INTO muscle_groups (nome, regiao, cadeia) VALUES (?, ?, ?)
            ON CONFLICT(nome) DO UPDATE SET regiao=excluded.regiao, cadeia=excluded.cadeia`,
      args: [g.nome, g.regiao, g.cadeia],
    })),
    "write",
  );
}
