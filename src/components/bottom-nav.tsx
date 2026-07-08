import { NavLink } from "react-router-dom";
import {
  House, Apple, UtensilsCrossed, Target, Dumbbell, ChartColumn, type LucideIcon,
} from "lucide-react";

const itens: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Hoje", icon: House },
  { to: "/alimentos", label: "Alimentos", icon: Apple },
  { to: "/refeicoes", label: "Refeições", icon: UtensilsCrossed },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/treino", label: "Treino", icon: Dumbbell },
  { to: "/analise", label: "Análise", icon: ChartColumn },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-background/70 backdrop-blur-xl">
      {/* fio de luz no topo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
      <div className="mx-auto grid max-w-md grid-cols-6 pb-[env(safe-area-inset-bottom)]">
        {itens.map((i) => {
          const Icon = i.icon;
          return (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === "/"}
              className={({ isActive }) =>
                `group relative flex flex-col items-center gap-1 py-2.5 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={`absolute top-0 h-0.5 w-8 rounded-full bg-primary shadow-[0_0_10px_0_var(--primary)] transition-opacity ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <Icon
                    className="size-5 transition-transform group-active:scale-90"
                    strokeWidth={isActive ? 2.4 : 1.8}
                  />
                  <span
                    className={`font-mono text-[0.58rem] uppercase tracking-[0.12em] ${
                      isActive ? "font-semibold" : ""
                    }`}
                  >
                    {i.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
