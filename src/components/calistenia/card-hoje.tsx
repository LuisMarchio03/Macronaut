import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, HandMetal, Plus } from "lucide-react";
import { CardRow } from "../ui/card";
import { useProfile } from "../../hooks/use-profile";
import { useSeriesDoDia } from "../../hooks/use-calistenia";
import { totaisPorExercicio } from "../../domain/calistenia";
import { comoRelogio, SheetRegistrarCalistenia, type EscolhaDeExercicio } from "./sheet-registrar";

/**
 * A calistenia do dia, numa linha.
 *
 * Era um card inteiro, com estado vazio e lista de atalhos, repetido no
 * dashboard E na aba "Hoje" do treino. Muito destaque para uma coisa que
 * talvez nem aconteça hoje — e duas telas contando a mesma história.
 *
 * Agora a calistenia tem aba própria, e aqui sobra o que uma linha responde:
 * quanto já foi feito, e um `+` para registrar sem sair do dashboard. Os
 * atalhos por exercício, as metas e a semana moram na aba.
 */
export function LinhaCalisteniaHoje({ data }: { data: string }) {
  const { data: perfil } = useProfile();
  const { data: series = [], isPending } = useSeriesDoDia(data);
  // `undefined` = folha fechada; `null` = aberta sem exercício escolhido.
  const [registrando, setRegistrando] = useState<EscolhaDeExercicio | null | undefined>(undefined);

  if (isPending) return null;

  const totais = totaisPorExercicio(series, perfil?.peso_kg ?? 0);
  // "Flexão 40 · Prancha 1:30" — cabe numa linha e diz o que importa. Acima de
  // dois exercícios vira contagem, que é o que ainda cabe.
  const resumo =
    totais.length === 0
      ? "nada registrado hoje"
      : totais.length <= 2
        ? totais
            .map((t) => `${t.nome} ${t.medida === "segundos" ? comoRelogio(t.quantidade) : t.quantidade}`)
            .join(" · ")
        : `${totais.length} exercícios`;

  return (
    <>
      <div className="flex items-center">
        <CardRow as={Link} to="/treino/calistenia" className="min-w-0 flex-1">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <HandMetal className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">Calistenia</span>
            <span className="t-caption block truncate tabular-nums">{resumo}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </CardRow>
        {/* O registro em dois toques sobrevive à mudança: é o que fazia o card
            valer a pena, e cabe num alvo de 44px. */}
        <button
          type="button"
          onClick={() => setRegistrando(null)}
          aria-label="Registrar série de calistenia"
          className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-muted"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <SheetRegistrarCalistenia
        aberto={registrando !== undefined}
        onFechar={() => setRegistrando(undefined)}
        data={data}
        exercicioInicial={registrando ?? null}
      />
    </>
  );
}
