import {
  ClipboardList,
  Download,
  Upload,
  Clock,
  Droplets,
  Pill,
  UtensilsCrossed,
  Trash2,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  useBlocos,
  useItensDoPlano,
  useMacrosDoPlano,
  usePlanoAtivo,
  usePlanos,
  useSubstituicoes,
  useAtivarPlano,
  useDeletarPlano,
} from "@/hooks/use-plano";
import { janelaHoraria } from "@/lib/date";
import type { TipoBloco } from "@/domain/plano-types";

const ICONE: Record<TipoBloco, typeof UtensilsCrossed> = {
  refeicao: UtensilsCrossed,
  agua: Droplets,
  suplemento: Pill,
};

const ROTULO_CATEGORIA: Record<string, string> = {
  proteina: "Proteína",
  carboidrato: "Carboidrato",
  fruta: "Fruta",
  gordura: "Gordura",
  vegetal: "Vegetal",
  outros: "Outros",
};

export function Plano() {
  const { data: plano, isLoading } = usePlanoAtivo();
  const { data: todos = [] } = usePlanos();
  const { data: blocos = [] } = useBlocos(plano?.id);
  const { data: itens } = useItensDoPlano(plano?.id);
  const { data: macros = [] } = useMacrosDoPlano(plano?.id);
  const { data: swaps = [] } = useSubstituicoes(plano?.id);
  const ativar = useAtivarPlano();
  const deletar = useDeletarPlano();

  const outros = todos.filter((p) => p.id !== plano?.id);

  const porCategoria = new Map<string, typeof swaps>();
  for (const s of swaps) {
    const lista = porCategoria.get(s.categoria);
    if (lista) lista.push(s);
    else porCategoria.set(s.categoria, [s]);
  }

  if (isLoading) {
    return (
      <Page>
        <SkeletonCard />
        <SkeletonCard />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader eyebrow="Plano alimentar" title={plano ? plano.nome : "Plano"} />

      <div className="grid grid-cols-2 gap-2">
        <ButtonLink to="/plano/importar">
          <Upload className="size-4" />
          Importar
        </ButtonLink>
        <ButtonLink variant="outline" href="/template-macronaut.xlsx" download>
          <Download className="size-4" />
          Template
        </ButtonLink>
      </div>

      {!plano ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="Nenhum plano importado"
            description="Baixe o template, preencha com a sua dieta e importe. O app passa a guiar o seu dia a partir dele."
          />
        </Card>
      ) : (
        <>
          <Card header="Metas do plano">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Meta
                rotulo="Calorias"
                valor={
                  plano.kcal_min == null
                    ? "—"
                    : plano.kcal_min === plano.kcal_max
                      ? `${plano.kcal_min}`
                      : `${plano.kcal_min}–${plano.kcal_max}`
                }
                unidade="kcal"
              />
              <Meta
                rotulo="Proteína"
                valor={plano.prot_alvo_g == null ? "—" : `${plano.prot_alvo_g}`}
                unidade="g"
              />
              <Meta
                rotulo="Água"
                valor={
                  plano.agua_ml_alvo == null
                    ? "—"
                    : (plano.agua_ml_alvo / 1000).toFixed(1).replace(".", ",")
                }
                unidade="L"
              />
              <Meta rotulo="Origem" valor={plano.origem === "xlsx" ? "Planilha" : "CSV"} />
            </dl>
          </Card>

          <div className="space-y-2">
            <SectionLabel>O dia inteiro</SectionLabel>
            <Card padded={false}>
              <ul className="divide-y divide-border">
                {blocos.map((b) => {
                  const Icone = ICONE[b.tipo];
                  const quando = janelaHoraria(b.hora_inicio, b.hora_fim) || b.ancora || "";
                  return (
                    <li key={b.id} className="flex gap-3 px-4 py-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icone className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-medium">{b.nome}</span>
                          <span className="t-caption shrink-0 tabular-nums">
                            {b.kcal_alvo != null && `~${b.kcal_alvo} kcal`}
                            {b.ml_alvo != null && `${b.ml_alvo} ml`}
                          </span>
                        </div>
                        {quando && (
                          <p className="t-caption mt-0.5 flex items-center gap-1.5">
                            <Clock className="size-3.5 shrink-0" aria-hidden />
                            <span className="tabular-nums">{quando}</span>
                          </p>
                        )}
                        {(itens?.get(b.id)?.length ?? 0) > 0 && b.tipo !== "agua" && (
                          <ul className="mt-2 space-y-1">
                            {itens!.get(b.id)!.map((i) => (
                              <li key={i.id} className="t-caption flex gap-2">
                                <span
                                  aria-hidden
                                  className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground"
                                />
                                <span className="min-w-0">{i.texto}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {b.observacao && <p className="t-caption mt-1.5 italic">{b.observacao}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          {macros.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Macros por refeição</SectionLabel>
              <Card padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="t-caption px-4 py-2 text-left font-medium">Refeição</th>
                        <th className="t-caption px-2 py-2 text-right font-medium">P</th>
                        <th className="t-caption px-2 py-2 text-right font-medium">C</th>
                        <th className="t-caption px-2 py-2 text-right font-medium">G</th>
                        <th className="t-caption px-4 py-2 text-right font-medium">kcal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {macros.map((m) => (
                        <tr key={m.id}>
                          <td className="px-4 py-2">{m.block_nome}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-macro-prot">
                            {m.prot_g}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-macro-carb">
                            {m.carb_g}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-macro-gord">
                            {m.gord_g}
                          </td>
                          <td className="px-4 py-2 text-right font-medium tabular-nums">
                            {m.kcal}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-border">
                      <tr className="font-semibold">
                        <td className="px-4 py-2">Total</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {Math.round(macros.reduce((s, m) => s + m.prot_g, 0))}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {Math.round(macros.reduce((s, m) => s + m.carb_g, 0))}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {Math.round(macros.reduce((s, m) => s + m.gord_g, 0))}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {Math.round(macros.reduce((s, m) => s + m.kcal, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {swaps.length > 0 && (
            <div className="space-y-2">
              <SectionLabel action={<span className="t-caption">{swaps.length} opções</span>}>
                Substituições
              </SectionLabel>
              {[...porCategoria.entries()].map(([categoria, opcoes]) => (
                <Card key={categoria} header={ROTULO_CATEGORIA[categoria] ?? categoria} padded={false}>
                  <ul className="divide-y divide-border">
                    {opcoes.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{s.alimento}</span>
                          <span className="t-caption block truncate">
                            {s.block_nome}
                            {s.porcao && ` · ${s.porcao}`}
                          </span>
                        </span>
                        <span className="t-caption shrink-0 tabular-nums">{s.kcal} kcal</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {outros.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>Planos anteriores</SectionLabel>
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {outros.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.nome}</span>
                    <span className="t-caption block">
                      importado em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ativar ${p.nome}`}
                    onClick={() => ativar.mutate(p.id)}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="destructive-ghost"
                    size="icon-sm"
                    aria-label={`Apagar ${p.nome}`}
                    onClick={() => deletar.mutate(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </Page>
  );
}

function Meta({
  rotulo,
  valor,
  unidade,
}: {
  rotulo: string;
  valor: string;
  unidade?: string;
}) {
  return (
    <div>
      <dt className="t-caption">{rotulo}</dt>
      <dd className="mt-0.5 flex items-baseline gap-1">
        <span className="text-lg font-bold tabular-nums">{valor}</span>
        {unidade && <span className="t-caption">{unidade}</span>}
      </dd>
    </div>
  );
}
