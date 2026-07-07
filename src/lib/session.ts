export type Session = { email: string; dbUrl: string; token: string; exp: number };

const KEY = "macronaut.session";

export function loadSession(now: number = Date.now()): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (!s.token || !s.dbUrl || typeof s.exp !== "number" || s.exp <= now) {
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
