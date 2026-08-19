import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface AbaNav {
  to: string;
  label: string;
  /** Só acende no caminho exato — sem isto a aba raiz é prefixo de todas. */
  fim?: boolean;
  /** Rotas que também acendem esta aba (ex.: o detalhe de uma sessão acende
   *  "Progresso", que é de onde ele foi aberto). */
  alias?: readonly string[];
}

/**
 * Abas de seção de uma tela, como LINKS.
 *
 * Não é o `Segmented`: aquele alterna visões dentro de uma tela e mora em
 * estado local; este navega entre rotas. A diferença importa no celular — com
 * links, o gesto de voltar volta uma aba, e um link vindo de fora (do
 * dashboard, de uma notificação, de um atalho do PWA) abre na aba certa.
 *
 * `aria-current="page"` em vez de `role="tab"`: são links de navegação de
 * verdade, e anunciá-los como abas ARIA prometeria a um leitor de tela um
 * painel que troca sem sair da página.
 *
 * O ativo é calculado aqui em vez de vir do `NavLink`: uma aba precisa acender
 * também nas rotas-filhas que nasceram dela (o detalhe de uma sessão pertence
 * a "Progresso"), e `NavLink` só sabe casar o próprio `to`. Sem isso, abrir
 * uma sessão deixava as quatro abas apagadas — a tela dizia "você não está em
 * lugar nenhum".
 */
export function TabsNav({ abas, rotulo }: { abas: readonly AbaNav[]; rotulo: string }) {
  const { pathname } = useLocation();

  return (
    <nav aria-label={rotulo}>
      <ul className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {abas.map((a) => {
          const ativo = a.fim
            ? pathname === a.to
            : pathname === a.to ||
              pathname.startsWith(`${a.to}/`) ||
              (a.alias?.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ?? false);

          return (
            <li key={a.to} className="flex-1">
              <Link
                to={a.to}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center justify-center rounded-md px-2 text-[0.8125rem] font-medium transition-colors",
                  ativo
                    ? "bg-card text-foreground shadow-[var(--shadow-1)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="truncate">{a.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
