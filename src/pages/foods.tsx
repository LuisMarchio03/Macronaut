import { useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { SectionCard } from "../components/ui/section-card";
import { EmptyState } from "../components/ui/empty-state";
import { FoodForm } from "../components/food-form";
import { useCustomFoods, useCreateFood, useUpdateFood, useDeleteFood } from "../hooks/use-foods";
import type { Food } from "../domain/types";

export function Foods() {
  const { data: foods = [] } = useCustomFoods();
  const criar = useCreateFood();
  const atualizar = useUpdateFood();
  const remover = useDeleteFood();
  const [editando, setEditando] = useState<Food | "novo" | null>(null);

  if (editando) {
    return (
      <div className="space-y-4 p-4">
        <header className="space-y-1 pt-2">
          <p className="section-title">Alimentos</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {editando === "novo" ? "Novo alimento" : "Editar alimento"}
          </h1>
        </header>
        <SectionCard variant="elevated" header={editando === "novo" ? "Novo" : "Editar"}>
          <FoodForm
            inicial={editando === "novo" ? undefined : editando}
            onCancelar={() => setEditando(null)}
            onSalvar={async (f) => {
              if (editando === "novo") await criar.mutateAsync(f);
              else await atualizar.mutateAsync({ id: editando.id, f });
              setEditando(null);
            }}
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between pt-2">
        <header className="space-y-1">
          <p className="section-title">Alimentos</p>
          <h1 className="text-2xl font-semibold tracking-tight">Meus alimentos</h1>
        </header>
        <Button size="sm" onClick={() => setEditando("novo")}>
          <Plus className="size-4" /> Novo
        </Button>
      </div>

      {foods.length === 0 ? (
        <EmptyState
          title="Nenhum alimento próprio"
          description="Crie alimentos personalizados para usar no seu diário."
          action={
            <Button size="sm" onClick={() => setEditando("novo")}>
              <Plus className="size-4" /> Criar alimento
            </Button>
          }
        />
      ) : (
        <SectionCard variant="elevated" header="Base própria" aside={`${foods.length} itens`} bodyClassName="p-1">
          <ul className="divide-y divide-border/40">
            {foods.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30">
                <span className="truncate text-sm">
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
          </ul>
        </SectionCard>
      )}
    </div>
  );
}