import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useSessoesAbertas } from "@/hooks/use-sessao";
import { useTempoDecorrido } from "@/hooks/use-tempo-decorrido";

/**
 * O treino que está acontecendo, visível de qualquer tela.
 *
 * Antes dela o único sinal de um treino em curso era um card dentro da aba
 * "Hoje" do treino: ir para a Nutrição, abrir o Dashboard ou fechar o app
 * significava perder o treino de vista — sem tempo decorrido e sem caminho de
 * volta. Foi assim que sessões ficaram abertas por dias.
 *
 * Mora no `ProtectedLayout`, e não no App inteiro, porque `/treino/sessao`
 * está FORA daquele layout: a faixa some sozinha exatamente onde seria
 * redundante, sem precisar consultar a rota para descobrir isso.
 *
 * Rascunho não aparece. Ele existe, mas não está acontecendo — anunciá-lo aqui
 * com um cronômetro correndo seria a faixa mentindo sobre o que a pessoa está
 * fazendo.
 */
export function FaixaTreinoAtivo() {
  const { data: abertas = [] } = useSessoesAbertas();
  const ativas = abertas.filter((s) => s.iniciado_em !== null);
  const atual = ativas[0];
  const decorrido = useTempoDecorrido(atual?.iniciado_em ?? null);

  if (!atual) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-2 pb-2">
      <Link
        to={`/treino/sessao?s=${atual.session_id}`}
        className="mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-primary/25 bg-tint-primary px-3 py-2.5 shadow-lg backdrop-blur-lg"
      >
        {/* O ponto pulsando diz "agora" sem gastar uma palavra — a faixa tem
            uma linha e meia de texto para dizer nome, tempo e progresso. */}
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {atual.nome ?? "Treino"}
            {/* Dois treinos abertos ao mesmo tempo cabem no hub, não aqui.
                O "+1" existe para você saber que o outro não sumiu. */}
            {ativas.length > 1 && (
              <span className="t-caption ml-1.5 font-normal">+{ativas.length - 1}</span>
            )}
          </span>
          <span className="t-caption block truncate tabular-nums">
            {decorrido}
            {atual.total > 0 && ` · ${atual.feitas} de ${atual.total} séries`}
          </span>
        </span>

        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}
