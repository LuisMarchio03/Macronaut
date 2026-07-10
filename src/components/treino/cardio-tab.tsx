import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { HudPanel } from "../ui/hud-panel";
import { X } from "lucide-react";
import { formatarData } from "../../lib/date";
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
      <HudPanel label="Registrar cardio" bodyClassName="space-y-2">
        <div>
          <Label htmlFor="atividade">Atividade</Label>
          <select id="atividade" className="hud-select"
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
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-primary/70">
            Estimativa · ~{sugestao} kcal (ajustável)
          </p>
        )}
        {!perfil && <p className="text-xs text-muted-foreground">Defina suas metas para estimar kcal automaticamente.</p>}
        <Button className="w-full" onClick={salvar}
          disabled={!tipo || Number(duracao) <= 0 || !(Number(kcal) > 0) || criar.isPending}>Salvar</Button>
      </HudPanel>

      <HudPanel label="Atividades recentes" aside={`${sessoes.length}`} bodyClassName="p-2">
        <ul className="divide-y divide-border/40">
          {sessoes.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 px-2 py-2">
              <span className="truncate font-mono text-[0.76rem] tabular-nums">
                {formatarData(s.data)} · {s.tipo} · {s.duracao_min}min · {Math.round(s.kcal)} kcal
              </span>
              <button
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                onClick={() => remover.mutate(s.id)} aria-label="excluir">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {sessoes.length === 0 && (
            <li className="px-2 py-4 text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Nenhuma atividade ainda</li>
          )}
        </ul>
      </HudPanel>
    </div>
  );
}
