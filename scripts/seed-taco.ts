import type { Client } from "@libsql/client";

export type TacoItem = {
  nome: string;
  base_qty_g: number;
  kcal: number;
  prot_g: number;
  carb_g: number;
  gord_g: number;
};

export async function importarTaco(db: Client, itens: TacoItem[]): Promise<number> {
  const created_at = new Date().toISOString();
  let inseridos = 0;
  for (const it of itens) {
    const existe = await db.execute({
      sql: "SELECT 1 FROM foods WHERE nome=? AND source='taco' LIMIT 1",
      args: [it.nome],
    });
    if (existe.rows.length) continue;
    await db.execute({
      sql: `INSERT INTO foods (nome, source, base_qty_g, kcal, prot_g, carb_g, gord_g, created_at)
            VALUES (?, 'taco', ?, ?, ?, ?, ?, ?)`,
      args: [it.nome, it.base_qty_g ?? 100, it.kcal ?? 0, it.prot_g ?? 0, it.carb_g ?? 0, it.gord_g ?? 0, created_at],
    });
    inseridos++;
  }
  return inseridos;
}
