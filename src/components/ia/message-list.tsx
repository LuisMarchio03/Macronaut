import { cn } from "../../lib/utils";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export function MessageList({ messages }: { messages: ChatMsg[] }) {
  return (
    <div className="space-y-3">
      {messages.map((m, i) => (
        <div
          key={i}
          className={cn(
            "max-w-[85%] rounded-xl px-3 py-2 text-sm",
            m.role === "user"
              ? "ml-auto bg-primary/15 text-foreground"
              : "mr-auto border border-border/50 bg-card/50 text-muted-foreground",
          )}
        >
          {m.content}
        </div>
      ))}
    </div>
  );
}
