import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Corners() {
  const base = "pointer-events-none absolute size-2.5 border-primary/55";
  return (
    <>
      <span className={cn(base, "left-1.5 top-1.5 border-l-[1.5px] border-t-[1.5px]")} />
      <span className={cn(base, "right-1.5 top-1.5 border-r-[1.5px] border-t-[1.5px]")} />
      <span className={cn(base, "bottom-1.5 left-1.5 border-b-[1.5px] border-l-[1.5px]")} />
      <span className={cn(base, "bottom-1.5 right-1.5 border-b-[1.5px] border-r-[1.5px]")} />
    </>
  );
}

export function HudPanel({
  label,
  aside,
  glow = false,
  scanlines = false,
  bodyClassName,
  className,
  children,
}: {
  label?: ReactNode;
  aside?: ReactNode;
  glow?: boolean;
  scanlines?: boolean;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "hud-panel rounded-xl",
        glow && "hud-panel--glow",
        scanlines && "scanlines",
        className,
      )}
    >
      <Corners />
      {(label || aside) && (
        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-2">
          {label && (
            <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {label}
            </span>
          )}
          {aside && (
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-primary/85 tabular-nums">
              {aside}
            </span>
          )}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
