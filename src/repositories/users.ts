import type { Client, Row } from "@libsql/client";

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  db_name: string;
  db_url: string;
  created_at: string;
};

export type NewUser = {
  email: string;
  password_hash: string;
  db_name: string;
  db_url: string;
};

function mapRow(r: Row): UserRow {
  return {
    id: r.id as number,
    email: r.email as string,
    password_hash: r.password_hash as string,
    db_name: r.db_name as string,
    db_url: r.db_url as string,
    created_at: r.created_at as string,
  };
}

export async function findUserByEmail(db: Client, email: string): Promise<UserRow | null> {
  const rs = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
  return rs.rows.length ? mapRow(rs.rows[0]) : null;
}

export async function insertUser(db: Client, u: NewUser): Promise<UserRow> {
  const created_at = new Date().toISOString();
  const rs = await db.execute({
    sql: `INSERT INTO users (email, password_hash, db_name, db_url, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [u.email, u.password_hash, u.db_name, u.db_url, created_at],
  });
  return { id: Number(rs.lastInsertRowid), ...u, created_at };
}
