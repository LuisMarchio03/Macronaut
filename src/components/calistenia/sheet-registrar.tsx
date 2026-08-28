import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { ExercicioAutocomplete } from "../treino/exercicio-autocomplete";
import { useExerciciosDeCalistenia, useRegistrarCalistenia } from "../../hooks/use-calistenia";
import type { Medida } from "../../domain/calistenia";

/** Reps andam de 1 em 1; segundos, de 5 em 5 — passo de 1 s numa prancha de
 *  dois minutos seria um contador que ninguém usa. */
const PASSO: Record<Medida, number> = { reps: 1, segundos: 5 };
/** Com quanto abrir quando não há última vez de onde copiar. */
const PADRAO: Record<Medida, number> = { reps: 10, segundos: 30 };

export interface EscolhaDeExercicio {
  exercise_id: number;
  nome: string;
  medida: Medida;
  /** Com quanto o stepper abre. */
  ultima_qtd: number;
}

/** 90 → "1:30". Segundo é a medida da isometria, e "90 segundos" se lê pior
 *  do que o relógio que a pessoa estava olhando enquanto segurava a prancha. */
export function comoRelogio(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Registrar uma série solta.
 *
 * Abre já no exercício e na quantidade da última vez: o caminho inteiro é
 * tocar o chip e confirmar. É o requisito do módulo — isso acontece em horário
 * aleatório do dia, e qualquer campo a mais é um registro que não vai acontecer.
 */
export function SheetRegistrarCalistenia({
  aberto,
  onFechar,
  data,
  exercicioInicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  data: string;
  exercicioInicial: EscolhaDeExercicio | null;
}) {
  const { data: catalogo = [] } = useExerciciosDeCalistenia();
  const registrar = useRegistrarCalistenia();

  const [escolha, setEscolha] = useState<EscolhaDeExercicio | null>(exercicioInicial);
  const [quantidade, setQuantidade] = useState(exercicioInicial?.ultima_qtd ?? PADRAO.reps);
  const [pesoExtra, setPesoExtra] = useState("");

  // A folha é reaberta com um exercício diferente a cada chip tocado.
  useEffect(() => {
    if (!aberto) return;
    setEscolha(exercicioInicial);
    setQuantidade(exercicioInicial?.ultima_qtd ?? PADRAO.reps);
    setPesoExtra("");
  }, [aberto, exercicioInicial]);

  const medida = escolha?.medida ?? "reps";
  const passo = PASSO[medida];

  function gravar() {
    if (!escolha || quantidade <= 0) return;
    const extra = Number(pesoExtra.replace(",", "."));
    registrar.mutate({
      data,
      exercise_id: escolha.exercise_id,
      reps: medida === "reps" ? quantidade : null,
      segundos: medida === "segundos" ? quantidade : null,
      peso_extra_kg: Number.isFinite(extra) && extra > 0 ? extra : null,
    });
    onFechar();
  }

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="truncate">{escolha ? escolha.nome : "Registrar série"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {!escolha ? (
            <div>
              <Label htmlFor="calistenia-exercicio">Exercício</Label>
              <ExercicioAutocomplete
                id="calistenia-exercicio"
                exercicios={catalogo}
                selecionado={null}
                onSelecionar={(e) => {
                  // A medida vem do exercício: sem ela a folha gravaria
                  // "60 repetições de prancha".
                  setEscolha({
                    exercise_id: e.id,
                    nome: e.nome,
                    medida: e.medida,
                    ultima_qtd: PADRAO[e.medida],
                  });
                  setQuantidade(PADRAO[e.medida]);
                }}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.max(passo, q - passo))}
                  aria-label="Menos"
                  className="flex size-14 items-center justify-center rounded-full border border-input transition-colors hover:bg-muted"
                >
                  <Minus className="size-6" />
                </button>
                <span className="min-w-[4ch] text-center">
                  <span className="block text-5xl font-bold tabular-nums">
                    {medida === "segundos" ? comoRelogio(quantidade) : quantidade}
                  </span>
                  <span className="t-caption block">
                    {medida === "segundos" ? "segundos" : "repetições"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => q + passo)}
                  aria-label="Mais"
                  className="flex size-14 items-center justify-center rounded-full border border-input transition-colors hover:bg-muted"
                >
                  <Plus className="size-6" />
                </button>
              </div>

              <div>
                <Label htmlFor="calistenia-extra">Peso extra (kg, opcional)</Label>
                <Input
                  id="calistenia-extra"
                  inputMode="decimal"
                  value={pesoExtra}
                  onChange={(e) => setPesoExtra(e.target.value)}
                  placeholder="Colete, anilha…"
                />
              </div>

              <Button block size="lg" onClick={gravar} disabled={registrar.isPending}>
                Registrar
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
