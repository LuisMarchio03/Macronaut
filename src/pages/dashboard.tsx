import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, ChevronRight, Dumbbell, Target, ClipboardList } from "lucide-react";
import { Card, CardRow } from "@/components/ui/card";
import { Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { Progress } from "@/components/ui/progress";
import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { EnergySummary } from "@/components/energy-summary";
import { DateNav } from "@/components/date-nav";
import { BlocoCard } from "@/components/plano/bloco-card";
import { LinhaCalisteniaHoje } from "@/components/calistenia/card-hoje";
import { SheetTrocas } from "@/components/plano/sheet-trocas";
import { useProfile } from "@/hooks/use-profile";
import { useMeals } from "@/hooks/use-meals";
import { useTodayEntries, useFoodsForEntries } from "@/hooks/use-today-entries";
import { useWaterToday } from "@/hooks/use-water-today";
import { useSessionByDate } from "@/hooks/use-workouts";
import { useSessaoAtiva } from "@/hooks/use-sessao";
import { useAiConfig } from "@/hooks/use-ai-config";
import {
  useAddAgua,
  useAguaPorBloco,
  useBlocos,
  useChecksDoDia,
  useItensDoPlano,
  useMarcarBloco,
  usePlanoAtivo,
  useSalvarTroca,
  useSubstituicoes,
  useTrocasDoDia,
} from "@/hooks/use-plano";
import { totaisDoDia, totaisPorRefeicao } from "@/domain/nutrition";
import { aderenciaDoDia, blocoEmFoco, metaDeAgua, montarDia } from "@/domain/plano-dia";
import { useDataAtiva } from "@/lib/data-context";
import { minutosAgora } from "@/lib/date";
import { estadoDaSessao } from "@/domain/sessao-estado";
import type { Macros, WorkoutSession } from "@/domain/types";
import type { PlanBlock } from "@/domain/plano-types";
import type { SessaoAberta } from "@/repositories/sessao";

const META_AGUA_PADRAO_ML = 3000;
const ZERO: Macros = { kcal: 0, prot_g: 0, carb_g: 0, gord_g: 0 };

/**
 * O card de treino do dashboard conta a mesma história que o hub `/treino`.
 *
 * Com um treino aberto, o dashboard dizia "Ver séries e cargas" e levava ao
 * hub — que por sua vez oferecia retomar. Duas telas, dois estados diferentes
 * do mesmo dia. Agora a sessão em andamento manda, e o atalho é para ela.
 */
function cardDeTreino(
  emAndamento: SessaoAberta | null | undefined,
  registrado: WorkoutSession | null | undefined,
): { to: string; titulo: string; legenda: string } {
  if (emAndamento) {
    return {
      to: `/treino/sessao?s=${emAndamento.session_id}`,
      titulo: emAndamento.nome || "Treino",
      legenda: `Em andamento · ${emAndamento.feitas} de ${emAndamento.total} séries`,
    };
  }
  // Concluído, não "existe": `getSessionByDate` devolve a primeira sessão do
  // dia seja qual for o estado dela, e um rascunho criado e nunca iniciado
  // anunciava aqui um treino que não aconteceu. Rascunho tem lugar próprio —
  // a lista de treinos abertos do hub.
  if (registrado && estadoDaSessao(registrado) === "concluida") {
    return {
      to: "/treino",
      titulo: registrado.nome || "Treino registrado",
      legenda: "Ver séries e cargas",
    };
  }
  return { to: "/treino", titulo: "Nenhum treino hoje", legenda: "Registrar uma sessão" };
}

export function Dashboard() {
  const { data, ehHoje } = useDataAtiva();
  const perfil = useProfile();
  const { data: entries = [] } = useTodayEntries(data);
  const { data: foods } = useFoodsForEntries(entries);
  const { data: totalAgua = 0 } = useWaterToday(data);
  const { data: treinoHoje } = useSessionByDate(data);
  const { data: sessaoAberta } = useSessaoAtiva();
  const { data: meals = [] } = useMeals();
  const { data: aiConfig } = useAiConfig();

  const { data: plano, isLoading: carregandoPlano } = usePlanoAtivo();
  const { data: blocos = [] } = useBlocos(plano?.id);
  const { data: itensPorBloco } = useItensDoPlano(plano?.id);
  const { data: swaps = [] } = useSubstituicoes(plano?.id);
  const { data: trocas = [] } = useTrocasDoDia(data);
  const { data: checks = [] } = useChecksDoDia(data);
  const { data: aguaPorBloco } = useAguaPorBloco(data);
  const marcar = useMarcarBloco(data);
  const salvarTroca = useSalvarTroca(data);
  const addAgua = useAddAgua(data);

  const [trocando, setTrocando] = useState<PlanBlock | null>(null);

  const iaDisponivel = aiConfig?.aloy_enabled || aiConfig?.gemini_enabled;
  const treino = cardDeTreino(sessaoAberta, treinoHoje);

  const meta: Macros = perfil.data
    ? {
        kcal: perfil.data.meta_kcal,
        prot_g: perfil.data.meta_prot_g,
        carb_g: perfil.data.meta_carb_g,
        gord_g: perfil.data.meta_gord_g,
      }
    : ZERO;

  const consumido: Macros = foods ? totaisDoDia(entries, foods) : ZERO;

  /* "Agora" só faz sentido no dia de hoje. Num dia passado, nenhum bloco está
     acontecendo e nenhum está atrasado — a linha do tempo vira histórico. */
  const dia = useMemo(
    () => montarDia(blocos, checks, ehHoje ? minutosAgora() : null),
    [blocos, checks, ehHoje],
  );

  const aderencia = aderenciaDoDia(dia);
  const foco = blocoEmFoco(dia);
  const metaAgua = plano ? metaDeAgua(blocos, plano.agua_ml_alvo) : META_AGUA_PADRAO_ML;

  const faixaKcal =
    plano?.kcal_min != null && plano?.kcal_max != null && plano.kcal_min !== plano.kcal_max
      ? { min: plano.kcal_min, max: plano.kcal_max }
      : null;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  if (perfil.isLoading || carregandoPlano) {
    return (
      <Page>
        <SkeletonCard />
        <SkeletonList rows={4} />
      </Page>
    );
  }

  if (!perfil.data) {
    return (
      <Page>
        <Card>
          <EmptyState
            icon={<Target className="size-6" />}
            title="Bem-vindo ao Macronaut"
            description="Configure suas metas para o app começar a acompanhar sua nutrição e seus treinos."
            action={
              <ButtonLink to="/metas">
                Definir metas
                <ChevronRight className="size-4" />
              </ButtonLink>
            }
          />
        </Card>
      </Page>
    );
  }



  return (
    <Page>
      {/* O nome do plano vem da planilha e costuma vir em caixa alta e longo —
          identifica bem, mas não é um bom título. Fica como contexto acima da
          saudação, e a data continua só no seletor. */}
      <PageHeader
        eyebrow={plano ? plano.nome : ehHoje ? "Resumo do dia" : "Consultando outro dia"}
        title={ehHoje ? saudacao : "Outro dia"}
        action={
          iaDisponivel && (
            <ButtonLink variant="ghost" size="icon" to="/ia" aria-label="Abrir assistente">
              <Bot className="size-5" />
            </ButtonLink>
          )
        }
      >
        <DateNav />
      </PageHeader>

      <Card tone="primary">
        <EnergySummary consumido={consumido} meta={meta} faixa={faixaKcal} />
      </Card>

      {plano ? (
        <div className="space-y-2">
          <SectionLabel
            action={
              aderencia.total > 0 && (
                <span className="t-caption tabular-nums">
                  {aderencia.feitas} de {aderencia.total} refeições
                </span>
              )
            }
          >
            Seu dia
          </SectionLabel>

          {aderencia.total > 0 && (
            <Progress
              value={aderencia.feitas}
              max={aderencia.total}
              tone="success"
              size="sm"
              label={`Aderência: ${aderencia.feitas} de ${aderencia.total} refeições`}
            />
          )}

          <div className="space-y-2 pt-1">
            {dia.map((item) => (
              <BlocoCard
                key={item.bloco.id}
                item={item}
                itens={itensPorBloco?.get(item.bloco.id) ?? []}
                aguaNoBloco={aguaPorBloco?.get(item.bloco.id) ?? 0}
                emFoco={item.bloco.id === foco?.bloco.id}
                trocas={trocas.filter((t) => t.block_id === item.bloco.id)}
                onMarcar={(feito) =>
                  marcar.mutate({ planId: plano.id, blockId: item.bloco.id, feito })
                }
                onTrocar={() => setTrocando(item.bloco)}
                onAgua={(ml) => addAgua.mutate({ ml, blockId: item.bloco.id })}
              />
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="Nenhum plano ativo"
            description="Importe a planilha da sua dieta e o app passa a guiar o seu dia: o que comer agora, quanto de água em cada período e quando tomar o suplemento."
            action={
              <ButtonLink to="/plano">
                Importar plano
                <ChevronRight className="size-4" />
              </ButtonLink>
            }
          />
        </Card>
      )}

      {/* Sem plano, a hidratação não tem períodos e vira um total do dia. */}
      {!plano && (
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <span className="t-caption text-foreground">Hidratação</span>
            <span className="t-caption tabular-nums">
              <span className="font-medium text-foreground">
                {(totalAgua / 1000).toFixed(1).replace(".", ",")} L
              </span>
              {" / "}
              {(metaAgua / 1000).toFixed(1).replace(".", ",")} L
            </span>
          </div>
          <Progress
            value={totalAgua}
            max={metaAgua}
            tone="carb"
            size="sm"
            className="mt-2.5"
            label={`Água: ${totalAgua} de ${metaAgua} mililitros`}
          />
          <p className="t-caption mt-2 tabular-nums">
            {metaAgua > 0 ? Math.round((totalAgua / metaAgua) * 100) : 0}% da meta
          </p>
        </Card>
      )}

      <RegistroDoDia entries={entries} foods={foods} meals={meals} />

      <div className="space-y-2">
        <SectionLabel>Treino</SectionLabel>
        {/* As duas linhas no mesmo card: respondem à mesma pergunta ("o que
            eu movi hoje?"), e a calistenia deixou de ser um card próprio —
            um bloco com estado vazio era muito espaço para algo que talvez
            nem aconteça hoje. O aprofundamento é a aba dela. */}
        <Card padded={false}>
          <div className="divide-y divide-border">
            <CardRow as={Link} to={treino.to}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Dumbbell className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{treino.titulo}</span>
                <span className="t-caption block truncate tabular-nums">{treino.legenda}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </CardRow>
            <LinhaCalisteniaHoje data={data} />
          </div>
        </Card>
      </div>

      {trocando && plano && (
        <SheetTrocas
          bloco={trocando}
          itens={itensPorBloco?.get(trocando.id) ?? []}
          swaps={swaps}
          trocas={trocas.filter((t) => t.block_id === trocando.id)}
          feito={dia.find((b) => b.bloco.id === trocando.id)?.estado === "feito"}
          onTrocar={(itemId, e) =>
            salvarTroca.mutate({
              entrada: { data, block_id: trocando.id, item_id: itemId, ...e },
            })
          }
          onDesfazer={(itemId) => salvarTroca.mutate({ itemId })}
          onMarcar={(feito) => marcar.mutate({ planId: plano.id, blockId: trocando.id, feito })}
          onClose={() => setTrocando(null)}
        />
      )}
    </Page>
  );
}

/** O que foi de fato registrado no diário, por refeição. */
function RegistroDoDia({
  entries,
  foods,
  meals,
}: {
  entries: ReturnType<typeof useTodayEntries>["data"] & object;
  foods: ReturnType<typeof useFoodsForEntries>["data"];
  meals: ReturnType<typeof useMeals>["data"] & object;
}) {
  const porRefeicao = foods ? totaisPorRefeicao(entries, foods) : new Map();
  const comRegistro = meals.filter((m) => (porRefeicao.get(m.id)?.kcal ?? 0) > 0);
  const avulsas = porRefeicao.get(null);

  return (
    <div className="space-y-2">
      <SectionLabel
        action={
          <Link to="/nutricao" className="text-[0.8125rem] font-medium text-primary">
            Ver tudo
          </Link>
        }
      >
        Registrado no diário
      </SectionLabel>

      <Card padded={false}>
        {comRegistro.length === 0 && !avulsas ? (
          <EmptyState
            title="Nada registrado ainda"
            description="Use o botão + para registrar o que você comeu."
          />
        ) : (
          <ul className="divide-y divide-border">
            {comRegistro.map((m) => (
              <li key={m.id}>
                <CardRow as={Link} to="/nutricao">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.nome}</span>
                  <span className="t-caption shrink-0 tabular-nums">
                    {Math.round(porRefeicao.get(m.id)!.kcal)} kcal
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </CardRow>
              </li>
            ))}
            {avulsas && (
              <li>
                <CardRow as={Link} to="/nutricao">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">Avulsas</span>
                  <span className="t-caption shrink-0 tabular-nums">
                    {Math.round(avulsas.kcal)} kcal
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </CardRow>
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
