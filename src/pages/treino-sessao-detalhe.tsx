import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ExercicioAutocomplete } from "@/components/treino/exercicio-autocomplete";
import { SheetConfirmar } from "@/components/ui/confirmar";
import { EmptyState } from "@/components/ui/empty-state";
import { BackLink } from "@/components/ui/page";
import { SkeletonList } from "@/components/ui/skeleton";
import { SheetAjustarSerie } from "@/components/treino/sheet-ajustar-serie";
import { SheetEditarExercicio } from "@/components/treino/sheet-editar-exercicio";
import { SheetEditarSessao } from "@/components/treino/sheet-editar-sessao";
import {
  useAdicionarAoPlano,
  useAdicionarSerie,
  useEditarSessao,
  usePlano,
  useRegistrarSerie,
  useRemoverExercicioDaSessao,
  useRemoverSerie,
  useReordenarExerciciosDaSessao,
  useSessao,
  useTrocarExercicioDaSessao,
} from "@/hooks/use-sessao";
import { useDeleteSession, useSessionSets, useUpdateSet } from "@/hooks/use-workouts";
import { useExercises } from "@/hooks/use-exercises";
import { seriesEfetivas, resumirSets, volumeSet } from "@/domain/treino";
import { dataPorExtenso, hoje } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { PlanoSerie } from "@/repositories/sessao";
import type { WorkoutSet } from "@/domain/types";

/** Uma linha do detalhe: o que era para ser, ao lado do que foi. */
function LinhaComparada({ s, onEditar }: { s: PlanoSerie; onEditar: () => void }) {
  const feita = s.set_id !== null || s.activity_id !== null;
  const cardio = s.duracao_min !== null;

  const prescrito = cardio ? `${s.duracao_min} min` : `${s.reps_alvo} × ${s.peso_kg} kg`;
  const realizado = cardio
    ? `${s.duracao_feita_min} min · ${Math.round(s.kcal_feita ?? 0)} kcal`
    : `${s.reps_feitas} × ${s.peso_feito_kg} kg`;

  const divergiu =
    feita &&
    !cardio &&
    (s.reps_feitas !== s.reps_alvo || s.peso_feito_kg !== s.peso_kg);

  return (
    <li className="flex items-center gap-2 pr-2 pl-4">
      <span className="t-caption w-5 shrink-0 tabular-nums">{s.serie_ordem}</span>
      <span className={cn("min-w-0 flex-1 py-2", !feita && "opacity-45")}>
        <span className="block text-sm font-medium tabular-nums">
          {feita ? realizado : prescrito}
        </span>
        <span className="t-caption block tabular-nums">
          {!feita
            ? "não feita"
            : divergiu
              ? `prescrito ${prescrito}`
              : cardio
                ? "como planejado"
                : `${s.pct !== null ? `${s.pct}%` : "como planejado"}`}
        </span>
      </span>
      {!cardio && (
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar série ${s.serie_ordem} de ${s.nome}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
        >
          <Pencil className="size-4" />
        </button>
      )}
    </li>
  );
}

/**
 * Sessão anterior a esta arquitetura: não tem plano, só o realizado.
 *
 * Mostrar uma coluna de "prescrito" vazia seria fingir que o app sabe o que
 * era para ser — e ele não sabe.
 */
function SemPlano({ sets, exercicios }: { sets: WorkoutSet[]; exercicios: { id: number; nome: string }[] }) {
  const nomeDe = (id: number) => exercicios.find((e) => e.id === id)?.nome ?? "?";
  const porExercicio = [...new Set(sets.map((s) => s.exercise_id))];

  return (
    <>
      <Card>
        <p className="t-caption">
          Esta sessão é anterior ao plano de treino, então só existe o que foi feito — o app não
          sabe o que era para ser.
        </p>
      </Card>
      {porExercicio.map((id) => {
        const efetivas = seriesEfetivas(sets.filter((s) => s.exercise_id === id));
        if (efetivas.length === 0) return null;
        return (
          <Card key={id} header={nomeDe(id)}>
            <p className="text-sm tabular-nums">{resumirSets(efetivas)}</p>
          </Card>
        );
      })}
    </>
  );
}

export function TreinoSessaoDetalhe() {
  const navigate = useNavigate();
  const { id } = useParams();
  const sessionId = id ? Number(id) : undefined;

  const { data: plano = [], isPending: carregandoPlano } = usePlano(sessionId);
  const { data: sets = [] } = useSessionSets(sessionId);
  const { data: exercicios = [] } = useExercises();
  const registrar = useRegistrarSerie();
  const atualizarSet = useUpdateSet(sessionId);
  const excluir = useDeleteSession();
  const removerExercicio = useRemoverExercicioDaSessao();
  const trocarExercicio = useTrocarExercicioDaSessao();
  const reordenarExercicios = useReordenarExerciciosDaSessao();
  const adicionarSerie = useAdicionarSerie();
  const removerSerie = useRemoverSerie();
  const editarSessao = useEditarSessao();
  const adicionarExercicio = useAdicionarAoPlano();

  const [editando, setEditando] = useState<PlanoSerie | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [editandoBloco, setEditandoBloco] = useState<number | null>(null);
  const [editandoSessao, setEditandoSessao] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  // Por id, e não por `find` num recorte do histórico: aquela lista passou a
  // trazer só sessões concluídas, então uma sessão ainda aberta, aberta pelo
  // endereço direto, ficaria sem cabeçalho nenhum. De quebra sai uma consulta
  // de 200 linhas de uma tela que precisava de uma.
  const { data: sessao } = useSessao(sessionId);

  // Séries e volume vinham prontos de `SessaoResumida`. Saem dos `sets` que a
  // tela já consulta — a mesma conta, sem uma segunda viagem ao banco.
  const efetivas = seriesEfetivas(sets);
  const volumeTotal = efetivas.reduce((acc, s) => acc + volumeSet(s.peso_kg, s.reps), 0);

  if (carregandoPlano) return <SkeletonList rows={4} />;

  // Blocos por exercício, na ordem do plano.
  const blocos: { exercise_id: number; nome: string; series: PlanoSerie[] }[] = [];
  for (const s of plano) {
    const ultimo = blocos.at(-1);
    if (ultimo && ultimo.exercise_id === s.exercise_id) ultimo.series.push(s);
    else blocos.push({ exercise_id: s.exercise_id, nome: s.nome, series: [s] });
  }

  const bloco = blocos.find((b) => b.exercise_id === editandoBloco) ?? null;

  return (
    <>
      {/* Sem `PageHeader`: a tela já tem um, com as abas. Aqui é o cabeçalho
          do conteúdo — e o link de volta diz de qual aba você veio. */}
      <div>
        <BackLink to="/treino/progresso">Progresso</BackLink>
        <div className="mt-0.5 flex items-start gap-2">
          <h2 className="t-title min-w-0 flex-1 truncate">{sessao?.nome || "Sessão"}</h2>
          {sessao && (
            <button
              type="button"
              onClick={() => setEditandoSessao(true)}
              aria-label="Editar sessão"
              className="-mt-1 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </div>
        {sessao && (
          <p className="t-caption tabular-nums">
            {dataPorExtenso(sessao.data)}
            {efetivas.length > 0 &&
              ` · ${efetivas.length} ${efetivas.length === 1 ? "série" : "séries"} · ${Math.round(volumeTotal).toLocaleString("pt-BR")} kg`}
          </p>
        )}
      </div>

      {plano.length === 0 ? (
        sets.length === 0 ? (
          <Card>
            <EmptyState
              title="Sessão sem exercício"
              description="Nenhum exercício foi adicionado a esta sessão ainda. Adicione o primeiro abaixo, ou apague a sessão."
            />
          </Card>
        ) : (
          <SemPlano sets={sets} exercicios={exercicios} />
        )
      ) : (
        blocos.map((b) => (
          <Card
            key={b.exercise_id}
            header={b.nome}
            aside={
              <button
                type="button"
                onClick={() => setEditandoBloco(b.exercise_id)}
                aria-label={`Editar exercício ${b.nome}`}
                className="-my-2 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
              >
                <Ellipsis className="size-5" />
              </button>
            }
            padded={false}
          >
            <ul className="divide-y divide-border">
              {b.series.map((s) => (
                <LinhaComparada key={s.id} s={s} onEditar={() => setEditando(s)} />
              ))}
            </ul>
          </Card>
        ))
      )}

      {/* Um treino já criado podia ter série somada, exercício trocado, movido
          e removido — mas não ganhar um exercício NOVO. A sessão vazia era o
          caso extremo: caía num estado com um único botão, o de apagar.
          Fora daqui só a sessão legada (`SemPlano`), que não tem plano onde
          encaixar um exercício novo. */}
      {sessionId !== undefined && !(plano.length === 0 && sets.length > 0) && (
        <div className="rounded-xl border border-dashed border-border p-3">
          {adicionando ? (
            <div>
              <Label htmlFor="add-detalhe">Exercício</Label>
              <ExercicioAutocomplete
                id="add-detalhe"
                exercicios={exercicios}
                selecionado={null}
                onSelecionar={(ex) => {
                  // A data da SESSÃO, não a de hoje: a carga sai do histórico
                  // até aquele dia, e usar hoje contaminaria um treino antigo
                  // com o que veio depois dele.
                  adicionarExercicio.mutate({
                    sessionId,
                    exerciseId: ex.id,
                    data: sessao?.data ?? hoje(),
                  });
                  setAdicionando(false);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdicionando(true)}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 text-[0.8125rem] font-medium text-primary"
            >
              <Plus className="size-4" />
              Adicionar exercício
            </button>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        block
        onClick={() => setConfirmandoExclusao(true)}
        className="text-destructive"
      >
        <Trash2 className="size-4" />
        Excluir esta sessão
      </Button>

      <SheetConfirmar
        aberto={confirmandoExclusao}
        onFechar={() => setConfirmandoExclusao(false)}
        titulo={`Excluir "${sessao?.nome || "esta sessão"}"?`}
        descricao="O treino e todas as séries registradas nele somem. Não dá para desfazer."
        onConfirmar={() => {
          if (sessionId === undefined) return;
          excluir.mutate(sessionId, { onSuccess: () => navigate("/treino/progresso") });
        }}
      />

      {bloco && sessionId !== undefined && (
        <SheetEditarExercicio
          aberto
          onFechar={() => setEditandoBloco(null)}
          nome={bloco.nome}
          totalDeExercicios={blocos.length}
          posicao={blocos.findIndex((b) => b.exercise_id === bloco.exercise_id)}
          totalDeSeries={bloco.series.length}
          catalogo={exercicios}
          onTrocar={(para) =>
            trocarExercicio.mutate({ sessionId, de: bloco.exercise_id, para })
          }
          onMover={(delta) => {
            const ids = blocos.map((b) => b.exercise_id);
            const i = ids.indexOf(bloco.exercise_id);
            [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
            reordenarExercicios.mutate({ sessionId, exerciseIds: ids });
          }}
          onAdicionarSerie={() =>
            adicionarSerie.mutate({ sessionId, exerciseId: bloco.exercise_id })
          }
          onRemoverSerie={() => removerSerie.mutate(bloco.series.at(-1)!.id)}
          onRemover={() =>
            removerExercicio.mutate({ sessionId, exerciseId: bloco.exercise_id })
          }
        />
      )}

      {sessao && (
        <SheetEditarSessao
          aberto={editandoSessao}
          onFechar={() => setEditandoSessao(false)}
          nome={sessao.nome}
          data={sessao.data}
          onSalvar={(v) => editarSessao.mutate({ id: sessao.id, ...v })}
        />
      )}

      <SheetAjustarSerie
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        serie={editando}
        onRegistrar={(v) => {
          if (!editando) return;
          // Série já registrada: corrige a linha existente. Ainda não
          // registrada: cria a série que ficou faltando naquele dia.
          if (editando.set_id !== null) {
            atualizarSet.mutate({ id: editando.set_id, ...v });
          } else {
            registrar.mutate({ planId: editando.id, ...v });
          }
        }}
      />
    </>
  );
}
