export type StoredUser = {
  id: number;
  email: string;
  password_hash: string;
};

export type LoginDeps = {
  findUser: (email: string) => Promise<StoredUser | null>;
  verify: (senha: string, hash: string) => Promise<boolean>;
  dummyHash: string;
  /**
   * Emite o bilhete de sessão do usuário.
   *
   * Era `session: { dbUrl, token }` — a mesma credencial do Turso para todo
   * mundo, entregue ao navegador. O login não devolve mais acesso ao banco:
   * devolve uma identidade assinada, e quem fala com o banco é o servidor.
   */
  emitirToken: (userId: number) => string;
};

export type LoginResult =
  | { ok: true; user: { id: number; email: string }; token: string }
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
  return {
    ok: true,
    user: { id: user.id, email: user.email },
    token: deps.emitirToken(user.id),
  };
}
