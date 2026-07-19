import { NavLink, useLocation } from "react-router-dom";
import {
  House, Drumstick, Dumbbell, ChartColumn, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const maisMatch = ["/alimentos", "/refeicoes", "/metas", "/ia", "/ajustes"];

const itens = [
  { to: "/", label: "Hoje", icon: House, match: undefined },
  { to: "/nutricao", label: "Nutrição", icon: Drumstick, match: undefined },
  { to: "/treino", label: "Treino", icon: Dumbbell, match: undefined },
  { to: "/analise", label: "Análise", icon: ChartColumn, match: undefined },
  { to: "/mais", label: "Mais", icon: Menu, match: maisMatch },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="mx-auto grid max-w-md grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {itens.map((i) => {
          const inMatch = i.match?.some((p) => pathname.startsWith(p)) ?? false;
          const ativo =
            i.to === "/"
              ? pathname === "/"
              : inMatch || pathname.startsWith(i.to);

          const Icon = i.icon;
          return (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === "/"}
              className={cn(
                "group relative flex flex-col items-center gap-1 py-2 transition-colors",
                ativo && "text-primary",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-0 h-0.5 w-6 rounded-full transition-all",
                  ativo
                    ? "bg-primary shadow-[0_0_10px_0_var(--primary)] opacity-100"
                    : "opacity-0",
                )}
              />
              <Icon
                className={cn(
                  "size-5 transition-all group-active:scale-90",
                  ativo
                    ? "text-primary scale-110"
                    : "text-muted-foreground",
                )}
                strokeWidth={ativo ? 2.4 : 1.8}
              />
              <span
                className={cn(
                  "font-mono text-[0.55rem] uppercase tracking-[0.14em] transition-colors",
                  ativo
                    ? "font-semibold text-primary"
                    : "text-muted-foreground",
                )}
              >
                {i.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}