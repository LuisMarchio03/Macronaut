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
 * Escopo: **atividade, peso e água**. Os três que o app já sabe usar —
 * atividade entra no balanço energético, peso alimenta o gráfico, água conta
 * na hidratação do dia (e nos períodos, quando há plano).
 *
 * Ficam de fora, e por motivos diferentes: **nutrição** exigiria casar cada
 * alimento com o catálogo, que é um problema de outra natureza; **passos**
 * contariam de novo o que a caminhada registrada já contou no balanço;
 * **sono** não tem lugar no app.
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

export interface AguaRecebida {
  /** `metadata.id` do `HydrationRecord`. É a chave da deduplicação. */
  origem_id: string;
  data: string;
  ml: number;
}

export interface Lote {
  origem: Origem;
  atividades: AtividadeRecebida[];
  pesos: PesoRecebido[];
  aguas: AguaRecebida[];
}

export interface Resultado {
  atividades: number;
  pesos: number;
  aguas: number;
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
  const aguasCru = c.aguas ?? [];
  if (!Array.isArray(atividadesCru) || !Array.isArray(pesosCru) || !Array.isArray(aguasCru)) {
    throw new LoteInvalido("atividades, pesos e aguas devem ser listas");
  }
  if (atividadesCru.length + pesosCru.length + aguasCru.length > LIMITE_ITENS) {
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

  const aguas = aguasCru.map((a): AguaRecebida => {
    const o = a as Record<string, unknown>;
    return {
      origem_id: texto(o.origem_id, "origem_id"),
      data: data(o.data, "data"),
      // Cinco litros num gole é erro de unidade (ml lido como litro, ou o
      // contrário), não sede.
      ml: numero(o.ml, "ml", { min: 1, max: 5000 }),
    };
  });

  return { origem: c.origem, atividades, pesos, aguas };
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

  for (const a of lote.aguas) {
    // Mesmo apaga-e-insere da atividade, e pelo mesmo motivo: `water_log` não
    // tem chave natural (o dia tem vários registros de propósito), então a
    // identidade vem da origem.
    comandos.push({
      sql: "DELETE FROM water_log WHERE user_id=? AND origem=? AND origem_id=?",
      args: [userId, lote.origem, a.origem_id],
    });
    comandos.push({
      sql: `INSERT INTO water_log (user_id, data, ml, origem, origem_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, a.data, a.ml, lote.origem, a.origem_id, agora],
    });
  }

  if (comandos.length > 0) await db.batch(comandos, "write");
  return {
    atividades: lote.atividades.length,
    pesos: lote.pesos.length,
    aguas: lote.aguas.length,
  };
}
