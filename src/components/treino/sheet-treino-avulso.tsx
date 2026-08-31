import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";

const PADRAO = "Treino avulso";

/**
 * O nome de um treino fora da rotina, antes de ele começar.
 *
 * Pergunta o nome porque dois avulsos no mesmo dia — e agora eles podem
 * coexistir — seriam duas linhas idênticas no histórico, indistinguíveis a
 * partir do dia seguinte. Um campo, com padrão preenchido: quem não se importa
 * toca em "Começar" e segue.
 */
export function SheetTreinoAvulso({
  aberto,
  onFechar,
  onComecar,
  pendente = false,
}: {
  aberto: boolean;
  onFechar: () => void;
  onComecar: (nome: string) => void;
  pendente?: boolean;
}) {
  const [nome, setNome] = useState(PADRAO);

  // Reabrir depois de um treino avulso não deve trazer o nome do anterior.
  useEffect(() => {
    if (aberto) setNome(PADRAO);
  }, [aberto]);

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Treino avulso</SheetTitle>
          <SheetDescription>
            Uma sessão vazia, fora da rotina. Você monta os exercícios na hora.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-4">
          <div>
            <Label htmlFor="avulso-nome">Nome</Label>
            <Input
              id="avulso-nome"
              value={nome}
              placeholder={PADRAO}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !pendente) onComecar(nome.trim() || PADRAO);
              }}
            />
          </div>
          <Button
            block
            disabled={pendente}
            onClick={() => onComecar(nome.trim() || PADRAO)}
          >
            <Play className="size-4" />
            Começar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
