const API = "https://api.turso.tech";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`variável de ambiente ${name} não definida`);
  return v;
}

export async function createDatabase(name: string): Promise<{ dbUrl: string }> {
  const org = required("TURSO_ORG");
  const res = await fetch(`${API}/v1/organizations/${org}/databases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("TURSO_PLATFORM_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, group: process.env.TURSO_GROUP ?? "default" }),
  });
  if (!res.ok) throw new Error(`Turso createDatabase ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { database: { Hostname: string } };
  return { dbUrl: `libsql://${body.database.Hostname}` };
}

export async function mintDbToken(dbName: string, days: number): Promise<string> {
  const org = required("TURSO_ORG");
  const url =
    `${API}/v1/organizations/${org}/databases/${dbName}/auth/tokens` +
    `?expiration=${days}d&authorization=full-access`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${required("TURSO_PLATFORM_TOKEN")}` },
  });
  if (!res.ok) throw new Error(`Turso mintDbToken ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { jwt?: string; token?: string };
  const token = body.jwt ?? body.token;
  if (!token) throw new Error("Turso mintDbToken: resposta sem jwt/token");
  return token;
}
