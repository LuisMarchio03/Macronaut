import { NavLink, useLocation } from "react-router-dom";
import {
  House, Dumbbell, ChartColumn, Settings, type LucideIcon,
} from "lucide-react";

const itens: { to: string; label: string; icon: LucideIcon; match?: string[] }[] = [
  { to: "/", label: "Hoje", icon: House },
  { to: "/treino", label: "Treino", icon: Dumbbell },
  { to: "/analise", label: "Análise", icon: ChartColumn },
  { to: "/ajustes", label: "Ajustes", icon: Settings, match: ["/alimentos", "/refeicoes", "/metas"] },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-background/70 backdrop-blur-xl">
      {/* fio de luz no topo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
      <div className="mx-auto grid max-w-md grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {itens.map((i) => {
          const Icon = i.icon;
          const matchAtivo = i.match?.some((p) => pathname.startsWith(p)) ?? false;
          return (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === "/"}
              className={({ isActive }) =>
                `group relative flex flex-col items-center gap-1 py-2.5 transition-colors ${
                  isActive || matchAtivo ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => {
                const ativo = isActive || matchAtivo;
                return (
                  <>
                    <span
                      aria-hidden
                      className={`absolute top-0 h-0.5 w-8 rounded-full bg-primary shadow-[0_0_10px_0_var(--primary)] transition-opacity ${
                        ativo ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <Icon
                      className="size-5 transition-transform group-active:scale-90"
                      strokeWidth={ativo ? 2.4 : 1.8}
                    />
                    <span
                      className={`font-mono text-[0.58rem] uppercase tracking-[0.12em] ${
                        ativo ? "font-semibold" : ""
                      }`}
                    >
                      {i.label}
                    </span>
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
