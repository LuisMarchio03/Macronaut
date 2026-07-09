export async function callAloy(
  baseUrl: string,
  token: string,
  message: string,
  sessionId: string | undefined,
): Promise<{ message: string; sessionId: string; degraded: boolean }> {
  const res = await fetch(`${baseUrl}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, session_id: sessionId ?? null }),
  });
  if (!res.ok) throw new Error(`aloy ${res.status}`);
  const d = (await res.json()) as { message: string; session_id: string; degraded?: boolean };
  return { message: d.message, sessionId: d.session_id, degraded: d.degraded ?? false };
}

export async function aloyHealth(
  baseUrl: string,
  token: string,
): Promise<{ up: boolean; detail?: string }> {
  try {
    const res = await fetch(`${baseUrl}/health`, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok ? { up: true } : { up: false, detail: `HTTP ${res.status}` };
  } catch {
    return { up: false, detail: "sem conexão" };
  }
}
