import { Check, Clock, Droplets, Pill, UtensilsCrossed, Repeat, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { janelaHoraria } from "@/lib/date";
import { descreverTroca, trocasDoItem } from "@/domain/plano-dia";
import type { BlocoDoDia } from "@/domain/plano-dia";
import type { PlanItem, TipoBloco, TrocaDeItem } from "@/domain/plano-types";

const ICONE: Record<TipoBloco, typeof UtensilsCrossed> = {
  refeicao: UtensilsCrossed,
  agua: Droplets,
  suplemento: Pill,
};

/** Quanto cada toque adiciona num período de água. */
const GOLES = [200, 500] as const;

const VERBO: Record<TipoBloco, string> = {
  refeicao: "Comi",
  suplemento: "Tomei",
  agua: "Bebi",
};

/**
 * Um bloco do plano na linha do tempo do dia.
 *
 * Só o bloco da vez abre. Com todos abertos a tela vira cinco metros de
 * rolagem em que nada se destaca — e a pergunta que o app precisa responder
 * ("o que eu faço agora?") fica escondida no meio. Os demais ficam numa linha
 * só, com um botão de marcar do tamanho do polegar caso você coma adiantado.
 */
export function BlocoCard({
  item: { bloco, estado },
  itens,
  trocas = [],
  aguaNoBloco = 0,
  emFoco = false,
  onMarcar,
  onTrocar,
  onAgua,
}: {
  item: BlocoDoDia;
  itens: PlanItem[];
  /** As trocas do dia. O card desenha o item trocado no lugar do original. */
  trocas?: TrocaDeItem[];
  aguaNoBloco?: number;
  /** Marca o passo atual para leitores de tela. Só um bloco por dia o recebe. */
  emFoco?: boolean;
  onMarcar: (feito: boolean) => void;
  onTrocar?: () => void;
  onAgua?: (ml: number) => void;
}) {
  const Icone = ICONE[bloco.tipo];
  const feito = estado === "feito";
  const agora = estado === "agora";
  const atrasado = estado === "atrasado";
  const aberto = agora || atrasado;

  const quando = janelaHoraria(bloco.hora_inicio, bloco.hora_fim) || bloco.ancora || "";
  const ehAgua = bloco.tipo === "agua";
  // Trocar deixou de depender do relógio e do check. Planejar o almoço às 9h
  // é uma coisa que se faz, e corrigir a troca de uma refeição já marcada
  // também — antes as duas exigiam desmarcar ou esperar a janela abrir.
  const podeTrocar = onTrocar !== undefined && !ehAgua && itens.length > 0;
  const metaAgua = bloco.ml_alvo ?? 0;
  const aguaCompleta = ehAgua && metaAgua > 0 && aguaNoBloco >= metaAgua;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        agora && "border-primary/40 bg-tint-primary",
        atrasado && "border-warning/40 bg-tint-warning",
        !aberto && "border-border bg-card",
      )}
      /* Mais de um bloco pode estar dentro da janela ao mesmo tempo (o período
         de água em tolerância e o almoço que acabou de abrir, por exemplo), mas
         "passo atual" é um só — vários `aria-current` deixam o leitor de tela
         sem saber para onde levar o usuário. */
      aria-current={emFoco ? "step" : undefined}
    >
      <div className={cn("flex items-start gap-3 px-4", aberto ? "py-4" : "py-3")}>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            (feito || aguaCompleta) && "bg-success/15 text-success",
            agora && !feito && !aguaCompleta && "bg-primary/15 text-primary",
            atrasado && !feito && !aguaCompleta && "bg-warning/15 text-warning",
            !feito && !aguaCompleta && !aberto && "bg-muted text-muted-foreground",
          )}
        >
          {feito || aguaCompleta ? (
            <Check className="size-5" strokeWidth={2.6} />
          ) : (
            <Icone className="size-[18px]" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3
              className={cn(
                "min-w-0 truncate text-[0.9375rem] font-semibold",
                feito && "text-muted-foreground",
              )}
            >
              {bloco.nome}
            </h3>
            <span className="t-caption shrink-0 tabular-nums">
              {bloco.kcal_alvo != null && `~${bloco.kcal_alvo} kcal`}
              {ehAgua && metaAgua > 0 && `${aguaNoBloco} / ${metaAgua} ml`}
            </span>
          </div>

          <p className="t-caption mt-0.5 flex flex-wrap items-center gap-x-1.5">
            {quando && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" aria-hidden />
                <span className="tabular-nums">{quando}</span>
              </span>
            )}
            {agora && <span className="font-medium text-primary">· agora</span>}
            {atrasado && (
              <span className="flex items-center gap-1 font-medium text-warning">
                <AlertCircle className="size-3.5" aria-hidden />
                passou do horário
              </span>
            )}
          </p>

          {ehAgua && metaAgua > 0 && (
            <Progress
              value={aguaNoBloco}
              max={metaAgua}
              tone={aguaCompleta ? "success" : "carb"}
              size="sm"
              className="mt-2"
              label={`${bloco.nome} ${quando}: ${aguaNoBloco} de ${metaAgua} mililitros`}
            />
          )}

          {aberto && bloco.observacao && (
            <p className="t-caption mt-2 italic">{bloco.observacao}</p>
          )}

          {aberto && !ehAgua && itens.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {itens.map((i) => {
                const troca = trocasDoItem(trocas, i.id)[0] ?? null;
                return (
                  <li key={i.id} className="flex gap-2 text-sm">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground"
                    />
                    {/* O original riscado continua visível: a troca só faz
                        sentido contra o que ela substituiu, e some-lo apagaria
                        o que o plano manda. */}
                    <span className="min-w-0">
                      <span className={troca ? "text-muted-foreground line-through" : undefined}>
                        {i.texto}
                      </span>
                      {troca && (
                        <span className="block font-medium text-primary">
                          {descreverTroca(troca)}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Ações grandes só no bloco da vez. */}
          {aberto && (
            <div className="mt-3 flex gap-2">
              {ehAgua
                ? onAgua &&
                  GOLES.map((ml) => (
                    <button
                      key={ml}
                      type="button"
                      onClick={() => onAgua(ml)}
                      className="h-10 flex-1 rounded-md border border-input bg-card text-sm font-medium transition-colors hover:bg-muted active:bg-muted"
                    >
                      +{ml} ml
                    </button>
                  ))
                : [
                    <button
                      key="marcar"
                      type="button"
                      onClick={() => onMarcar(!feito)}
                      className={cn(
                        "h-10 flex-1 rounded-md text-sm font-medium transition-colors",
                        feito
                          ? "border border-input text-muted-foreground hover:bg-muted"
                          : "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                    >
                      {feito ? "Desmarcar" : VERBO[bloco.tipo]}
                    </button>,
                    podeTrocar ? (
                      <button
                        key="trocar"
                        type="button"
                        onClick={onTrocar}
                        className="flex h-10 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        <Repeat className="size-4" aria-hidden />
                        Trocar
                      </button>
                    ) : null,
                  ]}
            </div>
          )}
        </div>

        {/* Fechado: alvos redondos de 44px para marcar adiantado ou desmarcar
            e para trocar, sem ocupar uma linha inteira do card. Trocar mora
            aqui também porque planejar a substituição do almoço às 9h da manhã
            é o caso comum — e antes o botão só existia na janela do bloco. */}
        {!aberto && !ehAgua && (
          <span className="flex shrink-0 items-center gap-1">
            {podeTrocar && (
              <button
                type="button"
                onClick={onTrocar}
                aria-label={`Trocar em ${bloco.nome}`}
                className="flex size-11 items-center justify-center rounded-full border border-input text-muted-foreground transition-colors hover:bg-muted"
              >
                <Repeat className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onMarcar(!feito)}
              aria-label={feito ? `Desmarcar ${bloco.nome}` : `Marcar ${bloco.nome} como feito`}
              aria-pressed={feito}
              className={cn(
                "flex size-11 items-center justify-center rounded-full border transition-colors",
                feito
                  ? "border-success/40 bg-success/15 text-success"
                  : "border-input text-muted-foreground hover:bg-muted",
              )}
            >
              <Check className="size-5" strokeWidth={feito ? 2.6 : 2} />
            </button>
          </span>
        )}
      </div>
    </article>
  );
}
