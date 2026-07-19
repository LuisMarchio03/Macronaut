import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SectionCard } from "../components/ui/section-card";
import { useMeals, useCreateMeal, useUpdateMeal, useDeleteMeal } from "../hooks/use-meals";

export function MealsConfig() {
  const { data: meals = [] } = useMeals();
  const criar = useCreateMeal();
  const atualizar = useUpdateMeal();
  const remover = useDeleteMeal();
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [horario, setHorario] = useState("");

  async function adicionar() {
    if (!nome.trim()) return;
    const ordem = (meals.at(-1)?.ordem ?? 0) + 1;
    await criar.mutateAsync({ nome: nome.trim(), horario: horario || null, ordem });
    setNome(""); setHorario(""); setNovo(false);
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-2">
        <p className="section-title">Configuração</p>
        <h1 className="text-2xl font-semibold tracking-tight">Refeições</h1>
      </header>

      {meals.length === 0 && !novo ? (
        <div className="flex justify-center pt-4">
          <Button onClick={() => setNovo(true)}>
            <Plus className="size-4" /> Adicionar refeição
          </Button>
        </div>
      ) : meals.length > 0 && (
        <SectionCard variant="elevated" header="Suas refeições" aside={`${meals.length} slots`} bodyClassName="p-1">
          <ul className="divide-y divide-border/40">
            {meals.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-muted/30">
                <Input aria-label={`horário de ${m.nome}`} type="time" className="w-28"
                  value={m.horario ?? ""}
                  onChange={(e) => atualizar.mutate({ id: m.id, m: { ...m, horario: e.target.value || null } })} />
                <span className="flex-1 truncate text-sm">{m.nome}</span>
                <button
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  onClick={() => remover.mutate(m.id)}
                  aria-label="excluir"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {novo ? (
        <SectionCard variant="outlined" header="Nova refeição" bodyClassName="space-y-3">
          <div>
            <Label htmlFor="novo-nome">Nome da refeição</Label>
            <Input id="novo-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Café da manhã" />
          </div>
          <div>
            <Label htmlFor="novo-horario">Horário</Label>
            <Input id="novo-horario" type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setNovo(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={adicionar}>Salvar</Button>
          </div>
        </SectionCard>
      ) : meals.length > 0 && (
        <Button variant="secondary" className="w-full" onClick={() => setNovo(true)}>
          <Plus className="size-4" /> Adicionar refeição
        </Button>
      )}
    </div>
  );
}