export type Session = { userId: number; email: string; dbUrl: string; token: string };

const KEY = "macronaut.session";

export function loadSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (typeof s.userId !== "number" || !s.token || !s.dbUrl || !s.email) {
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
