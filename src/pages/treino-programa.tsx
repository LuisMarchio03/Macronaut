import { useState } from "react";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BackLink, Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonCard } from "@/components/ui/skeleton";
import { ExercicioAutocomplete } from "@/components/treino/exercicio-autocomplete";
import { useExercises } from "@/hooks/use-exercises";
import {
  useAtualizarIncremento,
  useAtualizarTM,
  useCriarPrograma,
  useLevantamentos,
  usePosicao,
  useProgramaAtivo,
} from "@/hooks/use-programa";
import {
  escolherSugestao,
  LEVANTAMENTOS_SUGERIDOS,
  trainingMaxDe1RM,
  umRMDeTrainingMax,
  type Parte,
} from "@/domain/531";
import type { Exercise } from "@/domain/types";

const INCREMENTOS = [
  { valor: 1.25, label: "1,25 kg" },
  { valor: 2.5, label: "2,5 kg" },
  { valor: 5, label: "5 kg" },
];

const PARTES = [
  { valor: "inferior" as const, label: "Inferior", descricao: "Sobe 5 kg por ciclo" },
  { valor: "superior" as const, label: "Superior", descricao: "Sobe 2,5 kg por ciclo" },
];

interface Rascunho {
  exercicio: Exercise | null;
  valor: string;
  parte: Parte;
}

export function TreinoPrograma() {
  const { data: programa, isLoading } = useProgramaAtivo();
  const { data: lifts = [] } = useLevantamentos(programa);
  const { data: posicao } = usePosicao(programa);
  const { data: exercicios = [] } = useExercises();
  const criar = useCriarPrograma();
  const atualizarTM = useAtualizarTM();
  const atualizarInc = useAtualizarIncremento();

  const [incremento, setIncremento] = useState(2.5);
  /** O usuário informa 1RM ou TM; o app converte quando é 1RM. */
  const [entrada, setEntrada] = useState<"1rm" | "tm">("1rm");
  const [rascunhos, setRascunhos] = useState<Rascunho[]>(() =>
    LEVANTAMENTOS_SUGERIDOS.map((s) => ({ exercicio: null, valor: "", parte: s.parte })),
  );
  const [editandoTM, setEditandoTM] = useState<Record<number, string>>({});

  // Pré-seleciona os levantamentos clássicos assim que o catálogo carrega.
  const preenchidos = rascunhos.some((r) => r.exercicio !== null);
  if (!preenchidos && exercicios.length > 0) {
    const achados = LEVANTAMENTOS_SUGERIDOS.map((s, i) => ({
      exercicio: escolherSugestao(exercicios, s),
      valor: rascunhos[i]?.valor ?? "",
      parte: s.parte,
    }));
    if (achados.some((a) => a.exercicio)) setRascunhos(achados);
  }

  const validos = rascunhos.filter((r) => r.exercicio && Number(r.valor) > 0);

  function salvar() {
    criar.mutate({
      nome: "5/3/1",
      incremento_kg: incremento,
      levantamentos: validos.map((r) => ({
        exercise_id: r.exercicio!.id,
        tm_kg:
          entrada === "1rm"
            ? trainingMaxDe1RM(Number(r.valor), incremento)
            : Number(r.valor),
        parte: r.parte,
      })),
    });
  }

  if (isLoading) {
    return (
      <Page>
        <SkeletonCard />
      </Page>
    );
  }

  /* ── programa já existe: revisar ── */
  if (programa && lifts.length > 0) {
    return (
      <Page>
        <PageHeader eyebrow={<BackLink to="/treino">Treino</BackLink>} title="Programa" />

        <Card tone="primary">
          <p className="t-caption">5/3/1 · incremento de {programa.incremento_kg} kg</p>
          <p className="mt-1 text-sm">
            Ciclo {posicao?.ciclo ?? 1}, semana {posicao?.semana ?? 1}.{" "}
            {posicao?.ciclosFechados
              ? `${posicao.ciclosFechados} ciclo(s) fechado(s) — os Training Max abaixo já incluem as subidas.`
              : "Nenhum ciclo fechado ainda."}
          </p>
        </Card>

        <div className="space-y-2">
          <SectionLabel>Training Max</SectionLabel>
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {lifts.map((l) => {
                const emEdicao = editandoTM[l.id] !== undefined;
                return (
                  <li key={l.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium">{l.nome}</span>
                      <span className="t-caption shrink-0">
                        {l.parte === "inferior" ? "inferior" : "superior"}
                      </span>
                    </div>

                    {emEdicao ? (
                      <div className="mt-2 flex gap-2">
                        <Input
                          inputMode="decimal"
                          aria-label={`Training Max de ${l.nome}`}
                          value={editandoTM[l.id]}
                          onChange={(e) =>
                            setEditandoTM((s) => ({ ...s, [l.id]: e.target.value }))
                          }
                        />
                        <Button
                          onClick={() => {
                            const n = Number(editandoTM[l.id]);
                            if (n > 0) atualizarTM.mutate({ liftId: l.id, tm_kg: n });
                            setEditandoTM(({ [l.id]: _fora, ...resto }) => resto);
                          }}
                        >
                          <Check className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setEditandoTM((s) => ({ ...s, [l.id]: String(l.tm_inicial_kg) }))
                        }
                        className="mt-1 flex w-full items-baseline gap-2 text-left"
                      >
                        <span className="text-lg font-bold tabular-nums">{l.tm_kg} kg</span>
                        <span className="t-caption">
                          ≈ 1RM {umRMDeTrainingMax(l.tm_kg)} kg · tocar para ajustar
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <Card header="Incremento de anilha">
          <p className="t-caption mb-2">
            A menor troca de peso possível na sua academia. Define o arredondamento das cargas.
          </p>
          <ChipGroup
            opcoes={INCREMENTOS}
            valor={programa.incremento_kg}
            onChange={(v) =>
              v && atualizarInc.mutate({ programId: programa.id, incremento_kg: v })
            }
            rotulo="Incremento de anilha"
            colunas={3}
          />
        </Card>

        <Card header="Recomeçar">
          <p className="t-caption mb-3">
            Criar um programa novo guarda o atual e zera os ciclos. O histórico de treinos
            continua intacto.
          </p>
          <Button
            variant="outline"
            block
            onClick={() => {
              setRascunhos(
                LEVANTAMENTOS_SUGERIDOS.map((s) => ({ exercicio: null, valor: "", parte: s.parte })),
              );
              setEditandoTM({});
              criar.reset();
            }}
          >
            Configurar um novo programa
          </Button>
        </Card>
      </Page>
    );
  }

  /* ── setup inicial ── */
  return (
    <Page>
      <PageHeader eyebrow={<BackLink to="/treino">Treino</BackLink>} title="Configurar 5/3/1">
        <p className="t-caption">
          O método calcula a carga de cada série a partir do Training Max. Informe os seus e o
          app monta todas as sessões.
        </p>
      </PageHeader>

      <Card header="Incremento de anilha">
        <ChipGroup
          opcoes={INCREMENTOS}
          valor={incremento}
          onChange={(v) => v && setIncremento(v)}
          rotulo="Incremento de anilha"
          colunas={3}
        />
      </Card>

      <Card header="O que você vai informar">
        <ChipGroup
          opcoes={[
            { valor: "1rm" as const, label: "1RM" },
            { valor: "tm" as const, label: "Training Max" },
          ]}
          valor={entrada}
          onChange={(v) => v && setEntrada(v)}
          rotulo="Tipo de valor informado"
          colunas={2}
        />
        <p className="t-caption mt-2">
          {entrada === "1rm"
            ? "O Training Max é 90% do 1RM — o app faz a conta. Todo percentual do método incide sobre ele, não sobre o 1RM."
            : "Você já sabe seu Training Max. O app usa o valor como está."}
        </p>
      </Card>

      <div className="space-y-2">
        <SectionLabel>Levantamentos</SectionLabel>
        {rascunhos.map((r, i) => (
          <Card key={i}>
            <Label htmlFor={`ex-${i}`}>Exercício</Label>
            <ExercicioAutocomplete
              id={`ex-${i}`}
              exercicios={exercicios}
              selecionado={r.exercicio}
              onSelecionar={(ex) =>
                setRascunhos((s) => s.map((x, j) => (j === i ? { ...x, exercicio: ex } : x)))
              }
            />

            <div className="mt-3">
              <Label htmlFor={`valor-${i}`}>
                {entrada === "1rm" ? "1RM (kg)" : "Training Max (kg)"}
              </Label>
              <Input
                id={`valor-${i}`}
                inputMode="decimal"
                placeholder="ex: 120"
                value={r.valor}
                onChange={(e) =>
                  setRascunhos((s) =>
                    s.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)),
                  )
                }
              />
              {entrada === "1rm" && Number(r.valor) > 0 && (
                <p className="t-caption mt-1 tabular-nums">
                  Training Max: {trainingMaxDe1RM(Number(r.valor), incremento)} kg
                </p>
              )}
            </div>

            <div className="mt-3">
              <Label>Parte do corpo</Label>
              <ChipGroup
                opcoes={PARTES}
                valor={r.parte}
                onChange={(v) =>
                  v && setRascunhos((s) => s.map((x, j) => (j === i ? { ...x, parte: v } : x)))
                }
                rotulo={`Parte do corpo do levantamento ${i + 1}`}
                colunas={2}
              />
            </div>
          </Card>
        ))}
      </div>

      <Button block disabled={validos.length === 0 || criar.isPending} onClick={salvar}>
        {criar.isPending
          ? "Salvando…"
          : `Criar programa com ${validos.length} levantamento${validos.length === 1 ? "" : "s"}`}
      </Button>
    </Page>
  );
}
