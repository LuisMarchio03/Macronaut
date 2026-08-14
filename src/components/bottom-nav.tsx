import { NavLink, useLocation } from "react-router-dom";
import { House, UtensilsCrossed, Dumbbell, ChartColumn, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rotas que vivem sob "Mais" e devem acendê-lo. */
const SOB_MAIS = ["/alimentos", "/refeicoes", "/metas", "/ia", "/ajustes", "/plano"];

type ItemNav = {
  to: string;
  label: string;
  icon: typeof House;
  /** Só acende no caminho exato — sem isto "/" acenderia em toda rota. */
  exato?: boolean;
  /** Rotas que também acendem este item. */
  alias?: readonly string[];
};

const ITENS: readonly ItemNav[] = [
  { to: "/", label: "Hoje", icon: House, exato: true },
  { to: "/nutricao", label: "Nutrição", icon: UtensilsCrossed },
  { to: "/treino", label: "Treino", icon: Dumbbell },
  { to: "/analise", label: "Análise", icon: ChartColumn },
  { to: "/mais", label: "Mais", icon: Menu, alias: SOB_MAIS },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg"
    >
      <ul className="mx-auto flex max-w-lg pb-[env(safe-area-inset-bottom)]">
        {ITENS.map((item) => {
          const ativo = item.exato
            ? pathname === item.to
            : pathname.startsWith(item.to) ||
              (item.alias?.some((p) => pathname.startsWith(p)) ?? false);

          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.exato}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  // 56px de altura: o alvo de toque inteiro, não só o ícone.
                  "flex h-14 flex-col items-center justify-center gap-1 transition-colors",
                  ativo ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={ativo ? 2.2 : 1.7} />
                {/* Sem caixa-alta e sem tracking largo: em 10px isso era quase
                    ilegível, e o rótulo do menu é justamente o que precisa ser
                    lido de relance. */}
                <span className={cn("text-[0.6875rem] leading-none", ativo && "font-semibold")}>
                  {item.label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
