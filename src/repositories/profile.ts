import type { Client, Row } from "@libsql/client";
import type { Profile } from "../domain/types";

function mapRow(r: Row): Profile {
  return {
    id: 1,
    sexo: r.sexo as Profile["sexo"],
    data_nascimento: r.data_nascimento as string,
    altura_cm: r.altura_cm as number,
    peso_kg: r.peso_kg as number,
    fator_atividade: r.fator_atividade as number,
    objetivo: r.objetivo as Profile["objetivo"],
    meta_kcal: r.meta_kcal as number,
    meta_prot_g: r.meta_prot_g as number,
    meta_carb_g: r.meta_carb_g as number,
    meta_gord_g: r.meta_gord_g as number,
    updated_at: r.updated_at as string,
  };
}

export async function getProfile(db: Client): Promise<Profile | null> {
  const rs = await db.execute("SELECT * FROM profile WHERE id = 1");
  return rs.rows.length ? mapRow(rs.rows[0]) : null;
}

export async function upsertProfile(
  db: Client,
  p: Omit<Profile, "id" | "updated_at">,
): Promise<Profile> {
  const updated_at = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO profile
      (id, sexo, data_nascimento, altura_cm, peso_kg, fator_atividade, objetivo,
       meta_kcal, meta_prot_g, meta_carb_g, meta_gord_g, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        sexo=excluded.sexo, data_nascimento=excluded.data_nascimento,
        altura_cm=excluded.altura_cm, peso_kg=excluded.peso_kg,
        fator_atividade=excluded.fator_atividade, objetivo=excluded.objetivo,
        meta_kcal=excluded.meta_kcal, meta_prot_g=excluded.meta_prot_g,
        meta_carb_g=excluded.meta_carb_g, meta_gord_g=excluded.meta_gord_g,
        updated_at=excluded.updated_at`,
    args: [
      p.sexo, p.data_nascimento, p.altura_cm, p.peso_kg, p.fator_atividade,
      p.objetivo, p.meta_kcal, p.meta_prot_g, p.meta_carb_g, p.meta_gord_g, updated_at,
    ],
  });
  return { id: 1, ...p, updated_at };
}
