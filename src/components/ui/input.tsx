import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

/**
 * `text-base` (16px) é obrigatório: abaixo disso o Safari no iOS dá zoom
 * automático ao focar o campo e o layout salta. Não é preferência estética.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base",
        "transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
