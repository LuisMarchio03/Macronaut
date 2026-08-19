import { Button } from "./button";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "./sheet";

/**
 * A pergunta antes de uma ação sem volta.
 *
 * Excluir uma sessão apaga o treino e todas as séries dele; excluir um
 * alimento tira do catálogo algo que pode estar em registros antigos. Nenhuma
 * das duas tem desfazer, e as duas custavam um toque só — o mesmo toque que
 * registrar uma série. Uma pergunta é o preço certo.
 *
 * Segue a ordem da folha de ação do iOS: a ação destrutiva em cima, "Cancelar"
 * embaixo. Num sheet inferior o botão mais baixo é o mais fácil de acertar com
 * o polegar, e o mais fácil de acertar deve ser o que não destrói nada.
 */
export function SheetConfirmar({
  aberto,
  onFechar,
  titulo,
  descricao,
  rotulo = "Excluir",
  onConfirmar,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao?: string;
  /** O verbo da ação, no imperativo. "Excluir", "Descartar", "Sair sem salvar". */
  rotulo?: string;
  onConfirmar: () => void;
}) {
  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="rounded-t-2xl" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>{titulo}</SheetTitle>
          {descricao && <SheetDescription>{descricao}</SheetDescription>}
        </SheetHeader>
        <SheetFooter>
          <Button
            variant="destructive"
            block
            onClick={() => {
              onConfirmar();
              onFechar();
            }}
          >
            {rotulo}
          </Button>
          <Button variant="outline" block onClick={onFechar}>
            Cancelar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
