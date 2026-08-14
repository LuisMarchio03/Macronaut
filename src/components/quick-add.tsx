import { useState } from "react";
import { Plus } from "lucide-react";
import { AddFoodSheet } from "./add-food-sheet";
import { useMeals } from "../hooks/use-meals";
import { useDataAtiva } from "../lib/data-context";
import { refeicaoAtual } from "../domain/refeicao-atual";
import { minutosAgora } from "../lib/date";

/**
 * Ação primária: registrar um alimento de qualquer tela.
 *
 * Antes, sair da home e registrar algo custava quatro toques (Nutrição → rolar
 * → achar a refeição → adicionar). Aqui é um, e a refeição já vem escolhida
 * pelo horário — que é o que o usuário ia escolher de qualquer forma.
 */
export function QuickAdd() {
  const [aberto, setAberto] = useState(false);
  const { data } = useDataAtiva();
  const { data: meals = [] } = useMeals();

  const alvo = refeicaoAtual(meals, minutosAgora());

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={
          alvo ? `Registrar alimento em ${alvo.nome}` : "Registrar alimento"
        }
        className="fixed right-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-3)] transition-transform active:scale-95"
      >
        <Plus className="size-6" strokeWidth={2.4} />
      </button>

      {aberto && (
        <AddFoodSheet
          data={data}
          mealId={alvo?.id ?? null}
          open
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}
