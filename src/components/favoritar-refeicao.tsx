import { useState } from "react";
import { Star } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useCriarTemplate } from "../hooks/use-meal-templates";
import type { FoodEntry } from "../domain/types";

/**
 * Favoritar = tirar snapshot de uma refeição JÁ registrada. Não se monta uma
 * favorita do zero: isso é território do cadastro de dietas (spec, D4).
 */
export function FavoritarRefeicao({
  mealId, entries, sugestaoNome,
}: {
  mealId: number | null;
  entries: FoodEntry[];
  sugestaoNome: string;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState(sugestaoNome);
  const criar = useCriarTemplate();

  if (entries.length === 0) return null;

  // Toda abertura parte da sugestão fresca; todo fechamento a restaura. Sem
  // isso, reabrir a estrela na mesma refeição herdaria o nome digitado antes.
  function abrir() { setNome(sugestaoNome); setAbrindo(true); }
  function fechar() { setNome(sugestaoNome); setAbrindo(false); }

  if (!abrindo) {
    return (
      <button
        type="button"
        onClick={abrir}
        aria-label="favoritar refeição"
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <Star className="size-3.5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label="nome da favorita" value={nome} className="h-7 text-xs"
        onChange={(e) => setNome(e.target.value)} autoFocus
      />
      <Button
        size="sm" disabled={!nome.trim() || criar.isPending}
        onClick={async () => {
          await criar.mutateAsync({ nome: nome.trim(), mealId, entries });
          fechar();
        }}
      >
        Salvar
      </Button>
      <Button size="sm" variant="secondary" onClick={fechar}>Cancelar</Button>
    </div>
  );
}
