import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { BackLink, Page, PageHeader } from "../components/ui/page";
import { EmptyState } from "../components/ui/empty-state";
import {
  useMeals, useCreateMeal, useUpdateMeal, useDeleteMeal, useReordenarMeals,
} from "../hooks/use-meals";
import { ordemComNova } from "../domain/refeicoes";

export function MealsConfig() {
  const { data: meals = [] } = useMeals();
  const criar = useCreateMeal();
  const atualizar = useUpdateMeal();
  const remover = useDeleteMeal();
  const reordenar = useReordenarMeals();
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [horario, setHorario] = useState("");

  /**
   * Cria e já põe no lugar certo.
   *
   * Nascer no fim é o que fazia o café da manhã cadastrado depois do almoço
   * ficar preso no fim da lista — a `ordem` era um contador de criação
   * disfarçado de posição. Quem tem horário entra pelo horário; as setas
   * continuam mandando em tudo depois disso.
   */
  async function adicionar() {
    if (!nome.trim()) return;
    const ordem = (meals.at(-1)?.ordem ?? 0) + 1;
    const criada = await criar.mutateAsync({
      nome: nome.trim(),
      horario: horario || null,
      ordem,
    });
    if (criada.horario) await reordenar.mutateAsync(ordemComNova([...meals, criada], criada));
    setNome(""); setHorario(""); setNovo(false);
  }

  function mover(i: number, delta: number) {
    const ids = meals.map((m) => m.id);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    reordenar.mutate(ids);
  }

  return (
    <Page>
      <PageHeader eyebrow={<BackLink to="/mais">Mais</BackLink>} title="Refeições">
        <p className="t-caption">
          Os nomes e horários que aparecem no seu diário, na ordem em que você os
          arruma aqui. O plano alimentar tem os próprios blocos e não depende
          desta lista.
        </p>
      </PageHeader>

      {meals.length === 0 && !novo ? (
        <Card>
          <EmptyState
            title="Nenhuma refeição configurada"
            description="Crie as refeições do seu dia para organizar o diário."
            action={
              <Button onClick={() => setNovo(true)}>
                <Plus className="size-4" /> Adicionar refeição
              </Button>
            }
          />
        </Card>
      ) : meals.length > 0 && (
        <Card
          header="Suas refeições"
          aside={meals.length === 1 ? "1 refeição" : `${meals.length} refeições`}
          padded={false}
        >
          <ul className="divide-y divide-border">
            {meals.map((m, i) => (
              <li key={m.id} className="flex items-center gap-2 py-2 pr-3 pl-1">
                {/* Só com duas ou mais: um par de setas que nunca faz nada é
                    ruído a mais na linha. */}
                {meals.length > 1 && (
                  <span className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      aria-label={`Subir ${m.nome}`}
                      disabled={i === 0}
                      onClick={() => mover(i, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Descer ${m.nome}`}
                      disabled={i === meals.length - 1}
                      onClick={() => mover(i, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </span>
                )}
                <Input
                  aria-label={`horário de ${m.nome}`}
                  type="time"
                  className="w-32 shrink-0"
                  value={m.horario ?? ""}
                  onChange={(e) =>
                    atualizar.mutate({ id: m.id, m: { ...m, horario: e.target.value || null } })
                  }
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.nome}</span>
                <button
                  type="button"
                  onClick={() => remover.mutate(m.id)}
                  aria-label={`Excluir ${m.nome}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {novo ? (
        <Card header="Nova refeição" bodyClassName="space-y-3 px-4 pt-1 pb-4">
          <div>
            <Label htmlFor="novo-nome">Nome da refeição</Label>
            <Input id="novo-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Café da manhã" />
          </div>
          <div>
            <Label htmlFor="novo-horario">Horário</Label>
            <Input id="novo-horario" type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setNovo(false)}>
              Cancelar
            </Button>
            <Button onClick={adicionar} disabled={!nome.trim()}>
              Salvar
            </Button>
          </div>
        </Card>
      ) : meals.length > 0 && (
        <Button variant="outline" block onClick={() => setNovo(true)}>
          <Plus className="size-4" /> Adicionar refeição
        </Button>
      )}
    </Page>
  );
}