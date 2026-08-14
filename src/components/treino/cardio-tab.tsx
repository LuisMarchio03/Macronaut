import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { X } from "lucide-react";
import { dataPorExtenso } from "../../lib/date";
import { useDataAtiva } from "../../lib/data-context";
import { useProfile } from "../../hooks/use-profile";
import { useActivityTypes, useCreateActivity, useActivitySessions, useDeleteActivity } from "../../hooks/use-activities";
import { estimativaKcal } from "../../domain/treino";

export function CardioTab() {
  const { data } = useDataAtiva();
  const { data: perfil } = useProfile();
  const { data: tipos = [] } = useActivityTypes();
  const criar = useCreateActivity();
  const { data: sessoes = [] } = useActivitySessions();
  const remover = useDeleteActivity();

  const [tipo, setTipo] = useState("");
  const [duracao, setDuracao] = useState("");
  const [kcal, setKcal] = useState("");

  const met = tipos.find((t) => t.nome === tipo)?.met;
  const sugestao =
    met != null && perfil && Number(duracao) > 0
      ? Math.round(estimativaKcal(met, perfil.peso_kg, Number(duracao)))
      : null;

  // pré-preenche o kcal com a sugestão enquanto o usuário não digitou nada
  useEffect(() => {
    if (sugestao != null && kcal === "") setKcal(String(sugestao));
  }, [sugestao]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar() {
    if (!tipo || Number(duracao) <= 0 || !(Number(kcal) > 0)) return;
    await criar.mutateAsync({ data, tipo, duracao_min: Number(duracao), kcal: Number(kcal) });
    setDuracao(""); setKcal("");
  }

  return (
    <div className="space-y-4">
      <Card header="Registrar cardio" bodyClassName="space-y-3 px-4 pt-1 pb-4">
        <div>
          <Label htmlFor="atividade">Atividade</Label>
          <select id="atividade" className="select-field"
            value={tipo} onChange={(e) => { setTipo(e.target.value); setKcal(""); }}>
            <option value="">Selecione…</option>
            {tipos.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label htmlFor="dur">Duração (min)</Label>
            <Input id="dur" inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value)} /></div>
          <div><Label htmlFor="kcal">Kcal</Label>
            <Input id="kcal" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} /></div>
        </div>
        {sugestao != null && (
          <p className="t-caption tabular-nums">
            Estimativa: cerca de {sugestao} kcal. Dá para ajustar no campo acima.
          </p>
        )}
        {!perfil && (
          <p className="t-caption">Defina suas metas para o app estimar as calorias sozinho.</p>
        )}
        <Button
          block
          onClick={salvar}
          disabled={!tipo || Number(duracao) <= 0 || !(Number(kcal) > 0) || criar.isPending}
        >
          Salvar
        </Button>
      </Card>

      <Card
        header="Atividades recentes"
        aside={sessoes.length > 0 ? String(sessoes.length) : undefined}
        padded={false}
      >
        {sessoes.length > 0 ? (
          <ul className="divide-y divide-border">
            {sessoes.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-4 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.tipo}</span>
                  <span className="t-caption block truncate tabular-nums">
                    {dataPorExtenso(s.data)} · {s.duracao_min} min · {Math.round(s.kcal)} kcal
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remover.mutate(s.id)}
                  aria-label={`Excluir ${s.tipo} de ${dataPorExtenso(s.data)}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-caption px-4 pt-1 pb-4">Nenhuma atividade registrada ainda.</p>
        )}
      </Card>
    </div>
  );
}
