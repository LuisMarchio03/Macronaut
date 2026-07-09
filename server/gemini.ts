const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function callGemini(
  apiKey: string,
  model: string,
  systemText: string,
  contents: { role: "user" | "model"; text: string }[],
): Promise<string> {
  const res = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: contents.map((c) => ({ role: c.role, parts: [{ text: c.text }] })),
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function geminiHealth(apiKey: string, model: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${model}?key=${apiKey}`);
    return res.ok;
  } catch {
    return false;
  }
}
