import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SheetConfirmar } from "../components/ui/confirmar";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { BackLink, Page, PageHeader } from "../components/ui/page";
import { SheetAlimento } from "../components/sheet-alimento";
import { SheetFoodForm } from "../components/sheet-food-form";
import {
  useCatalogoFoods, useCategoriasFood, useCreateFood, useUpdateFood, useDeleteFood,
} from "../hooks/use-foods";
import { formatarNumero } from "../domain/medidas";
import { cn } from "../lib/utils";
import type { Food } from "../domain/types";

/**
 * A base de alimentos, para folhear.
 *
 * Ela listava só `source='custom'` — e o usuário típico tem zero deles. A tela
 * mostrava um estado vazio enquanto os 590 alimentos da TACO, já com
 * categoria, viviam no banco alcançáveis apenas por dentro do fluxo de
 * registrar comida. Catálogo que não dá para folhear não é catálogo.
 *
 * Busca, categoria e "só os meus" vêm antes da lista porque com 590 itens a
 * lista é palha, não conteúdo.
 */
export function Foods() {
  const [termo, setTermo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [apenasMeus, setApenasMeus] = useState(false);

  const { data: foods = [], isPending } = useCatalogoFoods({ termo, categoria, apenasMeus });
  const { data: categorias = [] } = useCategoriasFood();
  const criar = useCreateFood();
  const atualizar = useUpdateFood();
  const remover = useDeleteFood();

  const [vendo, setVendo] = useState<Food | null>(null);
  const [editando, setEditando] = useState<Food | "novo" | null>(null);
  const [excluindo, setExcluindo] = useState<Food | null>(null);

  return (
    <Page>
      <PageHeader
        eyebrow={<BackLink to="/mais">Mais</BackLink>}
        title="Alimentos"
        action={
          <Button size="sm" onClick={() => setEditando("novo")}>
            <Plus className="size-4" /> Novo
          </Button>
        }
      >
        <p className="t-caption">
          A tabela TACO e os seus. Os da TACO não podem ser editados; os seus, sim.
        </p>
      </PageHeader>

      <div className="space-y-3">
        <div>
          <Label htmlFor="food-busca">Buscar alimento</Label>
          <Input
            id="food-busca"
            value={termo}
            placeholder="arroz, frango, whey…"
            autoComplete="off"
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="food-categoria">Filtrar por categoria</Label>
          <select
            id="food-categoria"
            className="select-field"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          aria-pressed={apenasMeus}
          onClick={() => setApenasMeus((v) => !v)}
          className={cn(
            "min-h-9 rounded-lg border px-3 text-[0.8125rem] font-medium transition-colors",
            apenasMeus
              ? "border-primary/40 bg-tint-primary text-primary"
              : "border-input bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          Só os meus
        </button>
      </div>

      <Card
        header="Alimentos"
        aside={foods.length > 0 ? String(foods.length) : undefined}
        padded={false}
      >
        {foods.length > 0 ? (
          <ul className="divide-y divide-border">
            {foods.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setVendo(f)}
                  aria-label={`Ver ficha de ${f.nome}`}
                  className="min-h-12 w-full px-4 py-1.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="block truncate text-sm font-medium">{f.nome}</span>
                  <span className="t-caption block truncate tabular-nums">
                    {Math.round(f.kcal)} kcal por {formatarNumero(f.base_qty_g)} {f.base_unit}
                    {f.source === "custom" && " · seu"}
                    {f.categoria && ` · ${f.categoria}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : isPending ? (
          <p className="t-caption px-4 pt-1 pb-4">Carregando…</p>
        ) : (
          <p className="t-caption px-4 pt-1 pb-4">
            Nenhum alimento encontrado. Ajuste a busca ou o filtro — ou cadastre este como seu.
          </p>
        )}
      </Card>

      <SheetAlimento
        aberto={vendo !== null}
        onFechar={() => setVendo(null)}
        food={vendo}
        onEditar={(f) => {
          setVendo(null);
          setEditando(f);
        }}
        onExcluir={(f) => {
          setVendo(null);
          setExcluindo(f);
        }}
      />

      <SheetFoodForm
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        food={editando === "novo" ? null : editando}
        onSalvar={async (f) => {
          if (editando === "novo") await criar.mutateAsync(f);
          else if (editando) await atualizar.mutateAsync({ id: editando.id, f });
        }}
      />

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
