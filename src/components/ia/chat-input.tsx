import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export function ChatInput({ onSend, disabled }: { onSend: (texto: string) => void; disabled?: boolean }) {
  const [texto, setTexto] = useState("");
  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    onSend(t);
    setTexto("");
  };
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); enviar(); }}
    >
      <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pergunte à IA…" disabled={disabled} />
      <Button type="submit" disabled={disabled || !texto.trim()}>Enviar</Button>
    </form>
  );
}
