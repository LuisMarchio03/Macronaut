import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "./ui/sheet";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { useFoods } from "../hooks/use-foods";
import { useAddEntry, useUpdateEntry } from "../hooks/use-today-entries";
import { macrosDoEntry } from "../domain/nutrition";
import type { Food, FoodEntry } from "../domain/types";

export function AddFoodSheet({
  data, mealId, open, onClose, entryEdit,
}: {
  data: string;
  mealId: number | null;
  open: boolean;
  onClose: () => void;
  entryEdit?: { entry: FoodEntry; food: Food };
}) {
  const editando = entryEdit != null;
  const [termo, setTermo] = useState("");
  const [selecionado, setSelecionado] = useState<Food | null>(entryEdit?.food ?? null);
  const [qtd, setQtd] = useState(entryEdit ? String(entryEdit.entry.qty_g) : "100");
  const { data: resultados = [] } = useFoods(termo);
  const add = useAddEntry();
  const upd = useUpdateEntry(data);

  const qtdN = Number(qtd);
  const preview = selecionado && qtdN > 0 ? macrosDoEntry(selecionado, qtdN) : null;

  async function registrar() {
    if (!selecionado || qtdN <= 0) return;
    if (editando) {
      await upd.mutateAsync({ id: entryEdit!.entry.id, qty_g: qtdN });
    } else {
      await add.mutateAsync({
        data, meal_id: mealId, food_id: selecionado.id, qty_g: qtdN,
        measure_id: null, measure_count: null,
        label: mealId === null ? "Avulsa" : null,
      });
    }
    setSelecionado(null); setTermo(""); setQtd("100");
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-primary/70">
            Registro · alimento
          </p>
          <SheetTitle>{editando ? "Editar alimento" : "Adicionar alimento"}</SheetTitle>
          <SheetDescription>
            Busque um alimento, informe a quantidade em gramas e confirme para registrar.
          </SheetDescription>
        </SheetHeader>

        {!selecionado ? (
          <div className="flex-1 overflow-auto space-y-2 px-4">
            <Input placeholder="Buscar alimento…" value={termo}
              onChange={(e) => setTermo(e.target.value)} autoFocus />
            <ul className="space-y-0.5">
              {resultados.map((f) => (
                <li key={f.id}>
                  <button className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
                    onClick={() => setSelecionado(f)}>
                    {f.nome} <span className="font-mono text-xs text-muted-foreground">
                      · {Math.round(f.kcal)} kcal / {f.base_qty_g}g
                    </span>
                  </button>
                </li>
              ))}
              {termo && resultados.length === 0 && (
                <li className="py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Nada encontrado</li>
              )}
            </ul>
          </div>
        ) : (
          <div className="flex-1 space-y-4 px-4">
            <p className="font-medium">{selecionado.nome}</p>
            <div>
              <Label htmlFor="qtd">Quantidade (g)</Label>
              <Input id="qtd" inputMode="decimal" value={qtd}
                onChange={(e) => setQtd(e.target.value)} autoFocus />
            </div>
            {preview && (
              <p className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">
                {Math.round(preview.kcal)} kcal · P {Math.round(preview.prot_g)}g ·
                C {Math.round(preview.carb_g)}g · G {Math.round(preview.gord_g)}g
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => (editando ? onClose() : setSelecionado(null))}>Voltar</Button>
              <Button className="flex-1" onClick={registrar}
                disabled={qtdN <= 0 || add.isPending || upd.isPending}>
                {editando ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
