import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { EmptyState } from "../ui/empty-state";
import { dataPorExtenso, dataRelativa } from "../../lib/date";
import { useDataAtiva } from "../../lib/data-context";
import { useExercises } from "../../hooks/use-exercises";
import {
  useSessionByDate,
  useCreateSession,
  useSessionSets,
  useListSessions,
  useDeleteSession,
  useUpdateSession,
} from "../../hooks/use-workouts";
import { duracaoSessaoMin } from "../../domain/treino";
import { NovaSerieForm } from "./nova-serie-form";
import { ListaSeriesExercicio } from "./lista-series-exercicio";

/** Nota livre do dia. Grava no blur — sem botão salvar, que seria fricção pra um campo raro. */
function NotaSessao({
  sessionId,
  data,
  valor,
}: {
  sessionId: number;
  data: string;
  valor: string | null;
}) {
  const upd = useUpdateSession(data);
  const [texto, setTexto] = useState(valor ?? "");

  // Trocar de dia remonta com outro `valor`; sincroniza o campo.
  useEffect(() => {
    setTexto(valor ?? "");
  }, [valor, sessionId]);

  return (
    <Card>
      <Label htmlFor="nota-sessao">Nota do treino</Label>
      <Input
        id="nota-sessao"
        value={texto}
        placeholder="ombro incomodou, peguei leve…"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const novo = texto.trim() || null;
          if (novo !== (valor ?? null)) upd.mutate({ id: sessionId, nota: novo });
        }}
      />
    </Card>
  );
}

export function TreinoTab() {
  const { data } = useDataAtiva();
  const { data: sessao } = useSessionByDate(data);
  const criarSessao = useCreateSession();
  const { data: exercicios = [] } = useExercises();
  const { data: sets = [] } = useSessionSets(sessao?.id);
  const { data: recentes = [] } = useListSessions();
  const delSessao = useDeleteSession();

  const nomeEx = (id: number) => exercicios.find((e) => e.id === id)?.nome ?? "?";
  const porExercicio = [...new Set(sets.map((s) => s.exercise_id))];
  const duracao = duracaoSessaoMin(sets);

  return (
    <div className="space-y-3">
      {!sessao ? (
        <Card>
          <EmptyState
            title="Nenhum treino registrado"
            description={`Comece a sessão de ${dataRelativa(data).toLowerCase()} para registrar as séries.`}
            action={
              <Button
                onClick={() => criarSessao.mutateAsync({ data, nome: null })}
                disabled={criarSessao.isPending}
              >
                <Plus className="size-4" />
                Iniciar treino
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {sets.length > 1 && (
            <p className="t-caption px-0.5 tabular-nums" title="estimado, da 1ª à última série">
              Sessão de aproximadamente {duracao} min
            </p>
          )}
          <NotaSessao sessionId={sessao.id} data={data} valor={sessao.nota} />
          <NovaSerieForm sessionId={sessao.id} data={data} sets={sets} />
          {porExercicio.map((id) => (
            <ListaSeriesExercicio
              key={id}
              nome={nomeEx(id)}
              sets={sets.filter((s) => s.exercise_id === id)}
              sessionId={sessao.id}
            />
          ))}
        </>
      )}

      <Card
        header="Treinos recentes"
        aside={recentes.length > 0 ? String(recentes.length) : undefined}
        padded={false}
      >
        {recentes.length > 0 ? (
          <ul className="divide-y divide-border">
            {recentes.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-4 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {dataPorExtenso(r.data)}
                  {r.nome && ` · ${r.nome}`}
                </span>
                <button
                  type="button"
                  onClick={() => delSessao.mutate(r.id)}
                  aria-label={`Excluir treino de ${dataPorExtenso(r.data)}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-caption px-4 pt-1 pb-4">Nenhum treino registrado ainda.</p>
        )}
      </Card>
    </div>
  );
}
