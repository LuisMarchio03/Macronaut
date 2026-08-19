import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SheetConfirmar } from "../components/ui/confirmar";
import { BackLink, Page, PageHeader } from "../components/ui/page";
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
  const [excluindo, setExcluindo] = useState<Food | null>(null);

  if (editando) {
    return (
      <Page>
        <PageHeader
          eyebrow={<BackLink to="/mais">Alimentos</BackLink>}
          title={editando === "novo" ? "Novo alimento" : "Editar alimento"}
        />
        <Card>
          <FoodForm
            inicial={editando === "novo" ? undefined : editando}
            onCancelar={() => setEditando(null)}
            onSalvar={async (f) => {
              if (editando === "novo") await criar.mutateAsync(f);
              else await atualizar.mutateAsync({ id: editando.id, f });
              setEditando(null);
            }}
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow={<BackLink to="/mais">Mais</BackLink>}
        title="Meus alimentos"
        action={
          <Button size="sm" onClick={() => setEditando("novo")}>
            <Plus className="size-4" /> Novo
          </Button>
        }
      />

      {foods.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum alimento próprio"
            description="Crie alimentos personalizados para usar no seu diário além da tabela TACO."
            action={
              <Button onClick={() => setEditando("novo")}>
                <Plus className="size-4" /> Criar alimento
              </Button>
            }
          />
        </Card>
      ) : (
        <Card
          header="Base própria"
          aside={foods.length === 1 ? "1 alimento" : `${foods.length} alimentos`}
          padded={false}
        >
          <ul className="divide-y divide-border">
            {foods.map((f) => (
              <li key={f.id} className="flex items-center gap-1 px-2">
                <button
                  type="button"
                  onClick={() => setEditando(f)}
                  aria-label={`Editar ${f.nome}`}
                  className="min-h-11 min-w-0 flex-1 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="block truncate text-sm font-medium">{f.nome}</span>
                  <span className="t-caption block tabular-nums">
                    {Math.round(f.kcal)} kcal por {f.base_qty_g} g
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setExcluindo(f)}
                  aria-label={`Excluir ${f.nome}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <SheetConfirmar
        aberto={excluindo !== null}
        onFechar={() => setExcluindo(null)}
        titulo={`Excluir "${excluindo?.nome ?? ""}"?`}
        descricao="O alimento sai do seu catálogo. Registros antigos que usam ele continuam no diário."
        onConfirmar={() => {
          if (excluindo) remover.mutate(excluindo.id);
        }}
      />
    </Page>
  );
}