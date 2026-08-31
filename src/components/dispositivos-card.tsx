import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { EmptyState } from "./ui/empty-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { useApagarDispositivo, useDispositivos, useGerarCodigo } from "../hooks/use-dispositivos";
import { dataRelativa } from "../lib/date";

/** "4:37" — quanto falta do código na tela. */
function contagem(segundos: number): string {
  const m = Math.floor(Math.max(0, segundos) / 60);
  const s = Math.max(0, segundos) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * O código, e o relógio correndo contra ele.
 *
 * A contagem não é enfeite: o código vale cinco minutos, e sem mostrar isso a
 * pessoa que largou o celular na outra sala volta para uma tela que parece
 * boa e um pareamento que já não funciona.
 */
function FolhaDoCodigo({
  codigo,
  expiraEm,
  onFechar,
}: {
  codigo: string;
  expiraEm: string;
  onFechar: () => void;
}) {
  const [restante, setRestante] = useState(() =>
    Math.round((new Date(expiraEm).getTime() - Date.now()) / 1000),
  );

  useEffect(() => {
    const id = setInterval(
      () => setRestante(Math.round((new Date(expiraEm).getTime() - Date.now()) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [expiraEm]);

  const venceu = restante <= 0;

  return (
    <Sheet open onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Conectar um aparelho</SheetTitle>
          <SheetDescription>
            Abra o Macronaut no celular e digite este código para autorizá-lo a enviar seus
            treinos e pesagens.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          <div className="rounded-xl border border-border bg-muted py-6 text-center">
            <span
              className={
                venceu
                  ? "font-mono text-3xl font-bold tracking-[0.2em] text-muted-foreground line-through"
                  : "font-mono text-3xl font-bold tracking-[0.2em] tabular-nums"
              }
            >
              {codigo}
            </span>
            <p className="t-caption mt-2 tabular-nums">
              {venceu ? "expirou — gere outro" : `expira em ${contagem(restante)}`}
            </p>
          </div>
          <Button block variant="outline" className="mt-3" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Os aparelhos autorizados a mandar dados para a conta.
 *
 * Existe para o celular não precisar guardar a sua senha: ele troca um código
 * de cinco minutos por um token próprio, que só serve para enviar treino e
 * peso — nunca para ler ou escrever o resto do banco. Apagar aqui corta o
 * envio na sincronização seguinte.
 */
export function DispositivosCard() {
  const { data: dispositivos = [], isPending } = useDispositivos();
  const apagar = useApagarDispositivo();
  const gerar = useGerarCodigo();
  const [codigo, setCodigo] = useState<{ codigo: string; expira_em: string } | null>(null);

  if (isPending) return null;

  return (
    <>
      <Card
        header="Aparelhos conectados"
        aside={
          <button
            type="button"
            onClick={() => gerar.mutate(undefined, { onSuccess: setCodigo })}
            disabled={gerar.isPending}
            className="min-h-11 text-[0.8125rem] font-medium text-primary"
          >
            Conectar
          </button>
        }
        padded={dispositivos.length === 0}
      >
        {gerar.isError && (
          <p className="t-caption px-4 pb-2 text-destructive">
            {gerar.error instanceof Error ? gerar.error.message : "não consegui gerar o código"}
          </p>
        )}

        {dispositivos.length === 0 ? (
          <EmptyState
            icon={<Smartphone className="size-6" />}
            title="Nenhum aparelho conectado"
            description="Conecte o seu celular para os treinos e as pesagens do Samsung Health entrarem aqui sozinhos, sem você registrar de novo."
          />
        ) : (
          <ul className="divide-y divide-border">
            {dispositivos.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5 pr-2 pl-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Smartphone className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{d.nome}</span>
                  <span className="t-caption block truncate">
                    {d.visto_em
                      ? `sincronizou ${dataRelativa(d.visto_em.slice(0, 10))}`
                      : "conectado, ainda sem enviar nada"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => apagar.mutate(d.id)}
                  aria-label={`Desconectar ${d.nome}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {codigo && (
        <FolhaDoCodigo
          codigo={codigo.codigo}
          expiraEm={codigo.expira_em}
          onFechar={() => setCodigo(null)}
        />
      )}
    </>
  );
}
