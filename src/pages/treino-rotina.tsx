import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackLink, Page, PageHeader } from "@/components/ui/page";
import { SkeletonList } from "@/components/ui/skeleton";
import { ExercicioAutocomplete } from "@/components/treino/exercicio-autocomplete";
import { SheetPrescricao } from "@/components/treino/sheet-prescricao";
import { useExercises } from "@/hooks/use-exercises";
import {
  useAdicionarExercicio,
  useAtualizarExercicio,
  useCriarRotina,
  useDiasDaRotina,
  useExerciciosDaRotina,
  useRemoverDia,
  useRemoverExercicio,
  useReordenarExercicios,
  useRotinaAtiva,
  useSalvarDia,
} from "@/hooks/use-rotina";
import type { ExercicioRotina, ExercicioRotinaInput } from "@/repositories/rotina";

export const DIAS_DA_SEMANA = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
] as const;

/** Os padrões importam mais do que a tela: quem só quer adicionar um exercício
 *  e sair não precisa tocar em nada. */
const PADRAO: Omit<ExercicioRotinaInput, "exercise_id"> = {
  prescricao: "dupla",
  series: 3,
  reps_min: 8,
  reps_max: 12,
  peso_kg: 0,
  incremento_kg: 2.5,
  tm_kg: null,
  parte: null,
  descanso_s: 90, duracao_min: null,
};

/** "3 × 8–12" na dupla, "3 × 15" na fixa, "5/3/1 · TM 120 kg" no método. */
function resumoDaPrescricao(e: ExercicioRotina): string {
  if (e.prescricao === "531") return `5/3/1 · TM ${e.tm_kg ?? 0} kg`;
  if (e.prescricao === "fixa") return `${e.series} × ${e.reps_max ?? 0}`;
  return `${e.series} × ${e.reps_min ?? 0}–${e.reps_max ?? 0}`;
}

function Dia({
  diaSemana,
  dayId,
  nome,
  exercicios,
  onRenomear,
  onEditar,
}: {
  diaSemana: number;
  dayId: number | null;
  nome: string | null;
  exercicios: ExercicioRotina[];
  onRenomear: (nome: string) => void;
  onEditar: (e: ExercicioRotina) => void;
}) {
  const [editandoNome, setEditandoNome] = useState(false);
  const [texto, setTexto] = useState(nome ?? "");
  const [adicionando, setAdicionando] = useState(false);
  const { data: catalogo = [] } = useExercises();
  const adicionar = useAdicionarExercicio();
  const remover = useRemoverExercicio();
  const removerDia = useRemoverDia();
  const reordenar = useReordenarExercicios();

  const rotulo = DIAS_DA_SEMANA[diaSemana];
  const idBusca = `add-dia-${diaSemana}`;

  /** Move o exercício `i` casas para cima ou para baixo dentro do dia. */
  function mover(i: number, passo: -1 | 1) {
    if (dayId === null) return;
    const ids = exercicios.map((e) => e.id);
    const j = i + passo;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reordenar.mutate({ dayId, ids });
  }

  return (
    <Card padded={false}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <span className="t-caption w-16 shrink-0">{rotulo}</span>
        {editandoNome ? (
          <Input
            aria-label={`Nome do treino de ${rotulo.toLowerCase()}`}
            placeholder="Peito e tríceps"
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onBlur={() => {
              setEditandoNome(false);
              const novo = texto.trim();
              if (novo && novo !== nome) onRenomear(novo);
            }}
          />
        ) : !nome ? (
          // Dia de descanso é um convite, não um campo vazio: sete inputs
          // abertos faziam a rotina parecer um formulário de cadastro.
          <button
            type="button"
            onClick={() => { setTexto(""); setEditandoNome(true); }}
            aria-label={`Adicionar treino em ${rotulo.toLowerCase()}`}
            className="min-h-11 flex-1 text-left text-[0.9375rem] text-muted-foreground"
          >
            Descanso
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setTexto(nome); setEditandoNome(true); }}
              className="min-h-11 flex-1 text-left text-[0.9375rem] font-semibold"
            >
              {nome}
            </button>
            {/* Sem isto, nomear um dia por engano é irreversível: o campo só
                grava nome não-vazio, então não há como voltar a descanso. */}
            <button
              type="button"
              aria-label={`Tornar ${rotulo.toLowerCase()} um dia de descanso`}
              onClick={() => dayId !== null && removerDia.mutate(dayId)}
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
            >
              <X className="size-4" />
            </button>
          </>
        )}
      </div>

      {!nome && !editandoNome && <div className="pb-2" />}

      {nome && dayId !== null && (
        <>
          {exercicios.length > 0 && (
            <ul className="divide-y divide-border border-t border-border">
              {exercicios.map((e, i) => (
                <li key={e.id} className="flex items-center gap-1 pr-2 pl-4">
                  {exercicios.length > 1 && (
                  <span className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      aria-label={`Subir ${e.nome}`}
                      disabled={i === 0}
                      onClick={() => mover(i, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Descer ${e.nome}`}
                      disabled={i === exercicios.length - 1}
                      onClick={() => mover(i, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onEditar(e)}
                    aria-label={`Editar ${e.nome}`}
                    className="min-h-12 min-w-0 flex-1 py-2 text-left"
                  >
                    <span className="block truncate text-sm font-medium">{e.nome}</span>
                    <span className="t-caption block tabular-nums">
                      {resumoDaPrescricao(e)}
                      {e.prescricao !== "531" && e.peso_kg ? ` · ${e.peso_kg} kg` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${e.nome}`}
                    onClick={() => remover.mutate(e.id)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border px-4 py-2">
            {adicionando ? (
              <div>
                <Label htmlFor={idBusca}>Exercício</Label>
                <ExercicioAutocomplete
                  id={idBusca}
                  exercicios={catalogo}
                  selecionado={null}
                  onSelecionar={(ex) => {
                    adicionar.mutate({ dayId, entrada: { ...PADRAO, exercise_id: ex.id } });
                    setAdicionando(false);
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdicionando(true)}
                aria-label={`Adicionar exercício em ${rotulo.toLowerCase()}`}
                className="flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary"
              >
                <Plus className="size-4" />
                Adicionar exercício
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

export function TreinoRotina() {
  const { data: rotina, isLoading } = useRotinaAtiva();
  const { data: dias = [] } = useDiasDaRotina(rotina);
  const { data: todos = [] } = useExerciciosDaRotina(rotina);
  const criar = useCriarRotina();
  const salvarDia = useSalvarDia();
  const atualizar = useAtualizarExercicio();
  const [emEdicao, setEmEdicao] = useState<ExercicioRotina | null>(null);

  if (isLoading) {
    return (
      <Page>
        <SkeletonList rows={7} />
      </Page>
    );
  }

  if (!rotina) {
    return (
      <Page>
        <PageHeader eyebrow={<BackLink to="/treino">Treino</BackLink>} title="Rotina" />
        <Card>
          <EmptyState
            title="Nenhuma rotina ainda"
            description="Diga ao app o que você treina em cada dia da semana. Depois é só seguir — a carga de cada exercício ele calcula sozinho."
            action={
              <Button onClick={() => criar.mutate("Minha rotina")} disabled={criar.isPending}>
                Criar rotina
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader eyebrow={<BackLink to="/treino">Treino</BackLink>} title="Rotina">
        <p className="t-caption">
          Dia sem nome é descanso. Cada exercício guarda como a carga dele é decidida.
        </p>
      </PageHeader>

      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const dia = dias.find((x) => x.dia_semana === d) ?? null;
          return (
            <Dia
              key={d}
              diaSemana={d}
              dayId={dia?.id ?? null}
              nome={dia?.nome ?? null}
              exercicios={todos.filter((e) => e.dia_semana === d)}
              onRenomear={(nome) => salvarDia.mutate({ routineId: rotina.id, dia_semana: d, nome })}
              onEditar={setEmEdicao}
            />
          );
        })}
      </div>

      <SheetPrescricao
        aberto={emEdicao !== null}
        onFechar={() => setEmEdicao(null)}
        exercicio={emEdicao}
        onSalvar={(entrada) => {
          if (emEdicao) atualizar.mutate({ id: emEdicao.id, entrada });
        }}
      />
    </Page>
  );
}
