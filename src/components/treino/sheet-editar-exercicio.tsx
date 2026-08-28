import { useState } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, Repeat, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { SheetConfirmar } from "../ui/confirmar";
import { Label } from "../ui/label";
import { ExercicioAutocomplete } from "./exercicio-autocomplete";
import type { Exercise } from "../../domain/types";

/**
 * O que dá para fazer com um exercício DEPOIS de a sessão existir.
 *
 * Até aqui a sessão só crescia: dava para adicionar exercício e corrigir uma
 * série, nunca para remover, trocar ou reordenar. Um exercício escolhido por
 * engano ficava lá para sempre, e a única saída era apagar o treino inteiro —
 * levando junto tudo que tinha sido feito de verdade.
 *
 * A mesma folha serve a sessão da academia e ao detalhe de uma sessão passada:
 * as ações são as mesmas, e duas cópias divergiriam na primeira correção.
 */
export function SheetEditarExercicio({
  aberto,
  onFechar,
  nome,
  /** Quantos exercícios a sessão tem. Com um só, mover não é oferecido. */
  totalDeExercicios,
  /** Posição do bloco, base zero — decide quais setas fazem sentido. */
  posicao,
  /** Quantas séries o bloco tem. Com uma só, remover série vira remover o bloco. */
  totalDeSeries,
  catalogo,
  onTrocar,
  onMover,
  onAdicionarSerie,
  onRemoverSerie,
  onRemover,
}: {
  aberto: boolean;
  onFechar: () => void;
  nome: string;
  totalDeExercicios: number;
  posicao: number;
  totalDeSeries: number;
  catalogo: Exercise[];
  onTrocar: (exerciseId: number) => void;
  onMover: (delta: -1 | 1) => void;
  onAdicionarSerie: () => void;
  onRemoverSerie: () => void;
  onRemover: () => void;
}) {
  const [trocando, setTrocando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  function fechar() {
    setTrocando(false);
    onFechar();
  }

  return (
    <>
      <Sheet open={aberto} onOpenChange={(v: boolean) => !v && fechar()}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="truncate">{nome}</SheetTitle>
          </SheetHeader>

          {trocando ? (
            <div className="px-4 pb-4">
              <Label htmlFor="trocar-exercicio">Trocar por</Label>
              <ExercicioAutocomplete
                id="trocar-exercicio"
                exercicios={catalogo}
                selecionado={null}
                onSelecionar={(e) => {
                  onTrocar(e.id);
                  fechar();
                }}
              />
              <p className="t-caption mt-2">
                As séries já registradas vão junto para o exercício novo.
              </p>
            </div>
          ) : (
            <ul className="pb-4">
              <Acao
                icone={<Repeat className="size-[18px]" />}
                rotulo="Trocar exercício"
                onClick={() => setTrocando(true)}
              />
              {/* Com um exercício só não há para onde mover. Um par de setas
                  permanentemente desabilitado é ruído — o achado A10. */}
              {totalDeExercicios > 1 && (
                <>
                  <Acao
                    icone={<ArrowUp className="size-[18px]" />}
                    rotulo="Mover para cima"
                    desabilitado={posicao === 0}
                    onClick={() => {
                      onMover(-1);
                      fechar();
                    }}
                  />
                  <Acao
                    icone={<ArrowDown className="size-[18px]" />}
                    rotulo="Mover para baixo"
                    desabilitado={posicao === totalDeExercicios - 1}
                    onClick={() => {
                      onMover(1);
                      fechar();
                    }}
                  />
                </>
              )}
              <Acao
                icone={<Plus className="size-[18px]" />}
                rotulo="Adicionar série"
                sub="Copia o peso e as reps da última"
                onClick={() => {
                  onAdicionarSerie();
                  fechar();
                }}
              />
              <Acao
                icone={<Minus className="size-[18px]" />}
                rotulo="Remover última série"
                desabilitado={totalDeSeries <= 1}
                onClick={() => {
                  onRemoverSerie();
                  fechar();
                }}
              />
              <Acao
                icone={<Trash2 className="size-[18px]" />}
                rotulo="Remover da sessão"
                destrutivo
                onClick={() => setConfirmando(true)}
              />
            </ul>
          )}
        </SheetContent>
      </Sheet>

      <SheetConfirmar
        aberto={confirmando}
        onFechar={() => setConfirmando(false)}
        titulo={`Remover "${nome}" da sessão?`}
        descricao="As séries já registradas neste exercício somem junto. Não dá para desfazer."
        rotulo="Remover"
        onConfirmar={() => {
          onRemover();
          fechar();
        }}
      />
    </>
  );
}

function Acao({
  icone,
  rotulo,
  sub,
  desabilitado,
  destrutivo,
  onClick,
}: {
  icone: React.ReactNode;
  rotulo: string;
  sub?: string;
  desabilitado?: boolean;
  destrutivo?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={desabilitado}
        onClick={onClick}
        className={
          destrutivo
            ? "flex min-h-14 w-full items-center gap-3 px-4 text-left text-destructive transition-colors hover:bg-tint-danger disabled:opacity-40"
            : "flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-muted disabled:opacity-40"
        }
      >
        <span className="shrink-0">{icone}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{rotulo}</span>
          {sub && <span className="t-caption block truncate">{sub}</span>}
        </span>
      </button>
    </li>
  );
}
