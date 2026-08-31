import type { Client } from "@libsql/client";

/**
 * O que o celular manda, e o que o servidor aceita.
 *
 * Esta rota é TIPADA de propósito. O app web fala com `/api/db`, que aceita
 * SQL — é o mesmo poder que a tela já tem, e a sessão dele vive num navegador
 * que o dono controla. O celular é outra história: o token dele vai dentro de
 * um APK distribuído e não expira, então dar-lhe SQL seria trocar um problema
 * por um pior. Aqui ele só consegue dizer "corri 30 minutos", e o servidor
 * decide o que isso vira no banco.
 *
 * Escopo desta fase: **atividade e peso**. São os dois que o app já sabe usar
 * — atividade entra no balanço energético, peso alimenta o gráfico. Água,
 * passos, sono e nutrição ficam de fora por ora: água e nutrição precisariam
 * de deduplicação própria, e passos contariam de novo o que a caminhada
 * registrada já contou.
 */

export type Origem = "samsung-health" | "health-connect";

export interface AtividadeRecebida {
  /** O id do registro NA ORIGEM. É a chave da deduplicação. */
  origem_id: string;
  /** 'YYYY-MM-DD' — o dia a que a atividade pertence, no fuso do aparelho. */
  data: string;
  /** 'Corrida', 'Caminhada', 'Musculação'… como a origem chama. */
  tipo: string;
  duracao_min: number;
  kcal: number;
}

export interface PesoRecebido {
  data: string;
  peso_kg: number;
}

export interface Lote {
  origem: Origem;
  atividades: AtividadeRecebida[];
  pesos: PesoRecebido[];
}

export interface Resultado {
  atividades: number;
  pesos: number;
}

export class LoteInvalido extends Error {}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
/** Um lote maior que isto é sinal de laço errado no cliente, não de uso. */
export const LIMITE_ITENS = 500;

function texto(v: unknown, campo: string, max = 120): string {
  if (typeof v !== "string" || v.trim() === "") throw new LoteInvalido(`${campo} ausente`);
  if (v.length > max) throw new LoteInvalido(`${campo} longo demais`);
  return v.trim();
}

function numero(v: unknown, campo: string, { min, max }: { min: number; max: number }): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new LoteInvalido(`${campo} inválido`);
  if (v < min || v > max) throw new LoteInvalido(`${campo} fora da faixa`);
  return v;
}

function data(v: unknown, campo: string): string {
  const s = texto(v, campo, 10);
  if (!DATA.test(s)) throw new LoteInvalido(`${campo} deve ser YYYY-MM-DD`);
  return s;
}

export function lerLote(corpo: unknown): Lote {
  if (typeof corpo !== "object" || corpo === null) throw new LoteInvalido("corpo ausente");
  const c = corpo as Record<string, unknown>;

  if (c.origem !== "samsung-health" && c.origem !== "health-connect") {
    throw new LoteInvalido("origem desconhecida");
  }

  const atividadesCru = c.atividades ?? [];
  const pesosCru = c.pesos ?? [];
  if (!Array.isArray(atividadesCru) || !Array.isArray(pesosCru)) {
    throw new LoteInvalido("atividades e pesos devem ser listas");
  }
  if (atividadesCru.length + pesosCru.length > LIMITE_ITENS) {
    throw new LoteInvalido(`lote acima de ${LIMITE_ITENS} itens`);
  }

  const atividades = atividadesCru.map((a): AtividadeRecebida => {
    const o = a as Record<string, unknown>;
    return {
      origem_id: texto(o.origem_id, "origem_id"),
      data: data(o.data, "data"),
      tipo: texto(o.tipo, "tipo", 60),
      // Uma sessão de 24h é um relógio que não parou de contar, não um treino.
      duracao_min: numero(o.duracao_min, "duracao_min", { min: 0.1, max: 24 * 60 }),
      kcal: numero(o.kcal, "kcal", { min: 0, max: 20_000 }),
    };
  });

  const pesos = pesosCru.map((p): PesoRecebido => {
    const o = p as Record<string, unknown>;
    return {
      data: data(o.data, "data"),
      peso_kg: numero(o.peso_kg, "peso_kg", { min: 20, max: 500 }),
    };
  });

  return { origem: c.origem, atividades, pesos };
}

/**
 * Grava o lote, sem duplicar o que já veio antes.
 *
 * Apaga-e-insere por `(user_id, origem, origem_id)` em vez de `ON CONFLICT`:
 * o alvo do upsert seria um índice PARCIAL (só onde `origem` não é nula), e
 * casar conflito com índice parcial no SQLite depende de a cláusula bater
 * exatamente — dois comandos idempotentes são mais fáceis de defender do que
 * um upsert que funciona por coincidência.
 *
 * O que você registrou dentro do app tem `origem` nula e não é tocado: o
 * relógio corrige o que o relógio mandou, e nada além disso.
 */
export async function gravarLote(
  db: Client,
  userId: number,
  lote: Lote,
  agora = new Date().toISOString(),
): Promise<Resultado> {
  const comandos: { sql: string; args: (string | number | null)[] }[] = [];

  for (const a of lote.atividades) {
    comandos.push({
      sql: "DELETE FROM activity_sessions WHERE user_id=? AND origem=? AND origem_id=?",
      args: [userId, lote.origem, a.origem_id],
    });
    comandos.push({
      sql: `INSERT INTO activity_sessions
              (user_id, data, tipo, duracao_min, kcal, origem, origem_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, a.data, a.tipo, a.duracao_min, a.kcal, lote.origem, a.origem_id, agora],
    });
  }

  for (const p of lote.pesos) {
    // `weigh_ins` já tem UNIQUE (user_id, data): uma pesagem por dia, e a
    // última vence. Aqui o upsert é direto porque o índice é total.
    comandos.push({
      sql: `INSERT INTO weigh_ins (user_id, data, peso_kg, origem, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (user_id, data)
            DO UPDATE SET peso_kg = excluded.peso_kg, origem = excluded.origem`,
      args: [userId, p.data, p.peso_kg, lote.origem, agora],
    });
  }

  if (comandos.length > 0) await db.batch(comandos, "write");
  return { atividades: lote.atividades.length, pesos: lote.pesos.length };
}
