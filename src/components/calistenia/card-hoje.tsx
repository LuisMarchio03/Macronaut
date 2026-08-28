import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/empty-state";
import { Progress } from "../ui/progress";
import { useProfile } from "../../hooks/use-profile";
import {
  JANELA_DE_HABITO_DIAS, useMetasCalistenia, useSeriesDoDia, useUsadosRecentemente,
} from "../../hooks/use-calistenia";
import { totaisPorExercicio } from "../../domain/calistenia";
import { diasAtras } from "../../lib/date";
import { comoRelogio, SheetRegistrarCalistenia, type EscolhaDeExercicio } from "./sheet-registrar";

/**
 * A calistenia do dia, com o registro a dois toques.
 *
 * O mesmo componente no Dashboard e na aba "Hoje" do treino: duas telas
 * contando histórias diferentes sobre o mesmo estado é o defeito que o achado
 * B9 registrou no card de treino, e não vale a pena repeti-lo aqui.
 */
export function CardCalisteniaHoje({ data }: { data: string }) {
  const { data: perfil } = useProfile();
  const { data: series = [], isPending } = useSeriesDoDia(data);
  const { data: chips = [] } = useUsadosRecentemente(diasAtras(data, JANELA_DE_HABITO_DIAS));
  const { data: metas = [] } = useMetasCalistenia();
  // `undefined` = folha fechada; `null` = aberta sem exercício escolhido.
  const [registrando, setRegistrando] = useState<EscolhaDeExercicio | null | undefined>(undefined);

  const totais = totaisPorExercicio(series, perfil?.peso_kg ?? 0);

  if (isPending) return null;

  const vazio = totais.length === 0 && chips.length === 0;

  return (
    <>
      <Card
        header="Calistenia hoje"
        aside={
          <Link to="/treino/calistenia" className="text-[0.8125rem] font-medium text-primary">
            Ver tudo
          </Link>
        }
      >
        {vazio ? (
          <EmptyState
            title="Nada registrado ainda"
            description="As flexões e agachamentos soltos que você faz ao longo do dia entram aqui — e passam a contar no seu gasto de calorias."
            action={
              <button
                type="button"
                onClick={() => setRegistrando(null)}
                className="flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-medium text-primary"
              >
                <Plus className="size-4" /> Registrar série
              </button>
            }
          />
        ) : (
          <>
            {totais.length > 0 && (
              <ul className="space-y-2">
                {totais.map((t) => {
                  const meta = metas.find((m) => m.exercise_id === t.exercise_id);
                  const rotulo =
                    t.medida === "segundos" ? comoRelogio(t.quantidade) : String(t.quantidade);
                  return (
                    <li key={t.exercise_id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">{t.nome}</span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {meta ? `${rotulo} / ${meta.alvo_dia}` : rotulo}
                        </span>
                      </div>
                      {meta && (
                        <Progress
                          value={t.quantidade}
                          max={meta.alvo_dia}
                          size="sm"
                          className="mt-1"
                          label={`Meta de ${t.nome}`}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Os chips são o caminho de dois toques. Ficam mesmo num dia sem
                registro: é justamente aí que servem de convite. */}
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c.exercise_id}
                  type="button"
                  aria-label={`Registrar ${c.nome}`}
                  onClick={() =>
                    setRegistrando({
                      exercise_id: c.exercise_id,
                      nome: c.nome,
                      medida: c.medida,
                      ultima_qtd: c.ultima_qtd,
                    })
                  }
                  className="flex min-h-11 items-center gap-1 rounded-full bg-muted px-3 text-[0.8125rem] font-medium transition-colors hover:bg-muted/70"
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="max-w-[9rem] truncate">{c.nome}</span>
                </button>
              ))}
              <button
                type="button"
                aria-label="Registrar outro exercício"
                onClick={() => setRegistrando(null)}
                className="flex min-h-11 items-center rounded-full border border-dashed border-border px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </>
        )}
      </Card>

      <SheetRegistrarCalistenia
        aberto={registrando !== undefined}
        onFechar={() => setRegistrando(undefined)}
        data={data}
        exercicioInicial={registrando ?? null}
      />
    </>
  );
}
