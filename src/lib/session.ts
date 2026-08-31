/**
 * O que o app guarda de uma sessão.
 *
 * `dbUrl` e o token do Turso saíram: `token` agora é um bilhete assinado pelo
 * servidor, que não abre banco nenhum sozinho. Uma sessão antiga (com `dbUrl`)
 * é rejeitada por `loadSession` e cai no login — que é o certo, porque a
 * credencial que ela carregava deixou de valer.
 */
export type Session = { userId: number; email: string; token: string };

const KEY = "macronaut.session";

export function loadSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (typeof s.userId !== "number" || !s.token || !s.email || "dbUrl" in s) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function saveSession(s: Session): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
