const BASE = import.meta.env.VITE_AI_GATEWAY_URL ?? "";

export type ChatReq = { userId: number; provider: "gemini" | "aloy"; message: string; sessionId?: string };
export type ChatRes = { message: string; sessionId: string; provider: "gemini" | "aloy"; degraded: boolean };
export type HealthRes = { gemini: { up: boolean }; aloy: { up: boolean; detail?: string } };

export async function postChat(token: string, req: ChatReq): Promise<ChatRes> {
  const res = await fetch(`${BASE}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`ai/chat ${res.status}`);
  return (await res.json()) as ChatRes;
}

export async function getHealth(token: string, userId: number): Promise<HealthRes> {
  const res = await fetch(`${BASE}/ai/health?userId=${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ai/health ${res.status}`);
  return (await res.json()) as HealthRes;
}
