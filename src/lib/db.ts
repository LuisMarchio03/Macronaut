import { createClient, type Client } from "@libsql/client/web";

export type { Client };

export const db: Client = createClient({
  url: import.meta.env.VITE_TURSO_DATABASE_URL,
  authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN,
});

// Nota: a aplicação de FKs (PRAGMA foreign_keys = ON) é garantida de fato no
// harness de teste (conexão :memory: persistente, ver test/helpers/test-db.ts).
// O cliente web/HTTP usa conexões stateless por requisição no Turso, então o
// PRAGMA não persistiria entre chamadas em produção. Os repositories que
// dependem de ações referenciais (ex.: desvincular food_entries ao remover
// uma meal) tratam isso explicitamente — ver deleteMeal em
// src/repositories/meals.ts.
