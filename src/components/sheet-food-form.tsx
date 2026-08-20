import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { FoodForm } from "./food-form";
import type { Food } from "../domain/types";

/**
 * O cadastro de um alimento seu, em sheet.
 *
 * Antes ele trocava a tela inteira: cadastrar um alimento apagava a lista que
 * você estava consultando justamente para decidir se ele já existia — e voltar
 * te devolvia a lista sem busca e sem filtro, do começo.
 */
export function SheetFoodForm({
  aberto,
  onFechar,
  food,
  onSalvar,
}: {
  aberto: boolean;
  onFechar: () => void;
  /** `null` = novo. */
  food: Food | null;
  onSalvar: (f: Omit<Food, "id" | "source" | "created_at">) => Promise<void> | void;
}) {
  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{food ? "Editar alimento" : "Novo alimento"}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <FoodForm
            /* `key` remonta o formulário quando o alvo muda: os campos do
               FoodForm nascem de `useState(inicial)` e não se atualizariam
               sozinhos ao abrir o sheet para outro alimento. */
            key={food?.id ?? "novo"}
            inicial={food ?? undefined}
            onCancelar={onFechar}
            onSalvar={async (f) => {
              await onSalvar(f);
              onFechar();
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
