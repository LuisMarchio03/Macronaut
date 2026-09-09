import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";

const PADRAO = "Treino avulso";

/**
 * O nome de um treino fora da rotina, antes de ele existir.
 *
 * Pergunta o nome porque dois avulsos no mesmo dia — e eles podem coexistir —
 * seriam duas linhas idênticas no histórico, indistinguíveis a partir do dia
 * seguinte. Um campo, com padrão preenchido: quem não se importa toca em
 * "Criar treino" e segue.
 *
 * Cria, não começa: a sessão nasce rascunho, você monta os exercícios com
 * calma, e o relógio só corre quando você tocar em "Iniciar treino" na tela da
 * academia. Enquanto ela era criada já começando, sair da tela deixava para
 * trás um treino que o app considerava em curso.
 */
export function SheetTreinoAvulso({
  aberto,
  onFechar,
  onCriar,
  pendente = false,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (nome: string) => void;
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
            Uma sessão vazia, fora da rotina. Você monta os exercícios e decide
            quando ela começa.
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
                if (e.key === "Enter" && !pendente) onCriar(nome.trim() || PADRAO);
              }}
            />
          </div>
          <Button
            block
            disabled={pendente}
            onClick={() => onCriar(nome.trim() || PADRAO)}
          >
            <Plus className="size-4" />
            Criar treino
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
