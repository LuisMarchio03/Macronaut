import { Button } from "../ui/button";
import { HudPanel } from "../ui/hud-panel";
import { X } from "lucide-react";
import { formatarData } from "../../lib/date";
import { useDataAtiva } from "../../lib/data-context";
import { useExercises } from "../../hooks/use-exercises";
import {
  useSessionByDate, useCreateSession, useSessionSets,
  useListSessions, useDeleteSession, useUpdateSession,
} from "../../hooks/use-workouts";
import { duracaoSessaoMin } from "../../domain/treino";
import { NovaSerieForm } from "./nova-serie-form";
import { ListaSeriesExercicio } from "./lista-series-exercicio";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useEffect, useState } from "react";

/** Nota livre do dia. Grava no blur — sem botão salvar, que seria fricção pra um campo raro. */
function NotaSessao({
  sessionId, data, valor,
}: {
  sessionId: number;
  data: string;
  valor: string | null;
}) {
  const upd = useUpdateSession(data);
  const [texto, setTexto] = useState(valor ?? "");

  // Trocar de dia remonta com outro `valor`; sincroniza o campo.
  useEffect(() => { setTexto(valor ?? ""); }, [valor, sessionId]);

  return (
    <div>
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
    </div>
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
    <div className="space-y-4">
      <header className="flex items-baseline justify-between font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
        <span>{formatarData(data)}</span>
        {sets.length > 1 && <span title="estimado, da 1ª à última série">~{duracao} min</span>}
      </header>

      {!sessao ? (
        <Button onClick={() => criarSessao.mutateAsync({ data, nome: null })} disabled={criarSessao.isPending}>
          Iniciar treino de {formatarData(data)}
        </Button>
      ) : (
        <>
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

      <HudPanel label="Treinos recentes" aside={`${recentes.length}`} bodyClassName="p-2">
        <ul className="divide-y divide-border/40">
          {recentes.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-2">
              <span className="font-mono text-[0.8rem]">{formatarData(r.data)}{r.nome && ` · ${r.nome}`}</span>
              <button
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                onClick={() => delSessao.mutate(r.id)} aria-label="excluir">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {recentes.length === 0 && (
            <li className="px-2 py-4 text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Nenhum treino ainda</li>
          )}
        </ul>
      </HudPanel>
    </div>
  );
}
