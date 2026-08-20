import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Campo de texto de várias linhas.
 *
 * `text-base` (16px) pelo mesmo motivo do `Input`: abaixo disso o Safari no
 * iOS dá zoom ao focar e o layout salta.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base",
        "transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
