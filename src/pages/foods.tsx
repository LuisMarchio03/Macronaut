import { useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { HudPanel } from "../components/ui/hud-panel";
import { FoodForm } from "../components/food-form";
import { useCustomFoods, useCreateFood, useUpdateFood, useDeleteFood } from "../hooks/use-foods";
import type { Food } from "../domain/types";

function Masthead({ titulo }: { titulo: string }) {
  return (
    <header className="space-y-1 pt-1">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-primary/70">
        Catálogo · alimentos
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
    </header>
  );
}

export function Foods() {
  const { data: foods = [] } = useCustomFoods();
  const criar = useCreateFood();
  const atualizar = useUpdateFood();
  const remover = useDeleteFood();
  const [editando, setEditando] = useState<Food | "novo" | null>(null);

  if (editando) {
    return (
      <div className="space-y-4 p-4">
        <Masthead titulo={editando === "novo" ? "Novo alimento" : "Editar alimento"} />
        <HudPanel label={editando === "novo" ? "Novo alimento" : "Editar alimento"}>
          <FoodForm
            inicial={editando === "novo" ? undefined : editando}
            onCancelar={() => setEditando(null)}
            onSalvar={async (f) => {
              if (editando === "novo") await criar.mutateAsync(f);
              else await atualizar.mutateAsync({ id: editando.id, f });
              setEditando(null);
            }}
          />
        </HudPanel>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Masthead titulo="Meus alimentos" />
        <Button size="sm" onClick={() => setEditando("novo")}>
          <Plus className="size-4" /> Novo alimento
        </Button>
      </div>

      <HudPanel label="Base própria" aside={`${foods.length} itens`} bodyClassName="p-2">
        <ul className="divide-y divide-border/40">
          {foods.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-2 py-2.5">
              <span className="truncate">
                {f.nome}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  · {Math.round(f.kcal)} kcal / {f.base_qty_g}g
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
                  onClick={() => setEditando(f)}
                  aria-label="editar"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  onClick={() => remover.mutate(f.id)}
                  aria-label="excluir"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
          {foods.length === 0 && (
            <li className="px-2 py-6 text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
              Nenhum alimento próprio ainda
            </li>
          )}
        </ul>
      </HudPanel>
    </div>
  );
}
