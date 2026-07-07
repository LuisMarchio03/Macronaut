export type StoredUser = {
  email: string;
  password_hash: string;
  db_name: string;
  db_url: string;
};

export type LoginDeps = {
  findUser: (email: string) => Promise<StoredUser | null>;
  verify: (senha: string, hash: string) => Promise<boolean>;
  mintToken: (dbName: string) => Promise<{ token: string; exp: number }>;
  dummyHash: string;
};

export type LoginResult =
  | { ok: true; user: { email: string }; dbUrl: string; token: string; exp: number }
  | { ok: false };

export async function authenticate(
  deps: LoginDeps,
  input: { email: string; senha: string },
): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const user = await deps.findUser(email);
  // Sempre roda a verificação (mesmo sem usuário) para igualar o custo/timing.
  const senhaOk = await deps.verify(input.senha, user?.password_hash ?? deps.dummyHash);
  if (!user || !senhaOk) return { ok: false };
  const { token, exp } = await deps.mintToken(user.db_name);
  return { ok: true, user: { email: user.email }, dbUrl: user.db_url, token, exp };
}
