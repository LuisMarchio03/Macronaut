import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";

/**
 * O nome e o dia de uma sessão já registrada.
 *
 * A data é o motivo desta folha existir: treino registrado atrasado — no ônibus
 * de volta, ou no dia seguinte — cai no dia errado, e ali ele conta para a
 * consistência da semana errada e some da certa. Era a única coisa da sessão
 * que nenhuma tela sabia corrigir.
 */
export function SheetEditarSessao({
  aberto,
  onFechar,
  nome,
  data,
  onSalvar,
}: {
  aberto: boolean;
  onFechar: () => void;
  nome: string | null;
  data: string;
  onSalvar: (v: { nome: string | null; data: string }) => void;
}) {
  const [rascunhoNome, setRascunhoNome] = useState(nome ?? "");
  const [rascunhoData, setRascunhoData] = useState(data);

  // A folha é montada antes de a sessão carregar; sem isto os campos ficariam
  // com o vazio do primeiro render depois de os dados chegarem.
  useEffect(() => {
    if (aberto) {
      setRascunhoNome(nome ?? "");
      setRascunhoData(data);
    }
  }, [aberto, nome, data]);

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Editar sessão</SheetTitle>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-4">
          <div>
            <Label htmlFor="sessao-nome">Nome do treino</Label>
            <Input
              id="sessao-nome"
              value={rascunhoNome}
              onChange={(e) => setRascunhoNome(e.target.value)}
              placeholder="Ex: Peito e tríceps"
            />
          </div>
          <div>
            <Label htmlFor="sessao-data">Data</Label>
            <Input
              id="sessao-data"
              type="date"
              value={rascunhoData}
              onChange={(e) => setRascunhoData(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" block onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              block
              disabled={!rascunhoData}
              onClick={() => {
                onSalvar({ nome: rascunhoNome.trim() || null, data: rascunhoData });
                onFechar();
              }}
            >
              Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
