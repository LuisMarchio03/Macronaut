import { useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { HudPanel } from "../ui/hud-panel";
import { useExercises, useCreateExercise, useUpdateExercise, useDeleteExercise } from "../../hooks/use-exercises";
import type { Exercise } from "../../domain/types";

export function ExerciciosTab() {
  const { data: exercicios = [] } = useExercises();
  const criar = useCreateExercise();
  const atualizar = useUpdateExercise();
  const remover = useDeleteExercise();
  const [editando, setEditando] = useState<Exercise | "novo" | null>(null);
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("");
  const [aviso, setAviso] = useState("");

  function abrir(e: Exercise | "novo") {
    setEditando(e);
    setNome(e === "novo" ? "" : e.nome);
    setGrupo(e === "novo" ? "" : (e.grupo_muscular ?? ""));
    setAviso("");
  }

  async function salvar() {
    if (!nome.trim()) return;
    const dados = { nome: nome.trim(), grupo_muscular: grupo.trim() || null };
    if (editando === "novo") await criar.mutateAsync(dados);
    else if (editando) await atualizar.mutateAsync({ id: editando.id, e: dados });
    setEditando(null);
  }

  async function excluir(e: Exercise) {
    const r = await remover.mutateAsync(e.id);
    if (!r.ok) setAviso(`"${e.nome}" está em uso e não pode ser excluído.`);
    else setAviso("");
  }

  if (editando) {
    return (
      <HudPanel
        label={editando === "novo" ? "Novo exercício" : "Editar exercício"}
        bodyClassName="space-y-3"
      >
        <div><Label htmlFor="ex-nome">Nome</Label>
          <Input id="ex-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><Label htmlFor="ex-grupo">Grupo muscular (opcional)</Label>
          <Input id="ex-grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} /></div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
          <Button className="flex-1" onClick={salvar} disabled={!nome.trim()}>Salvar</Button>
        </div>
      </HudPanel>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Biblioteca
        </h2>
        <Button size="sm" onClick={() => abrir("novo")}>
          <Plus className="size-4" /> Novo exercício
        </Button>
      </div>
      {aviso && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {aviso}
        </p>
      )}
      <HudPanel label="Exercícios" aside={`${exercicios.length}`} bodyClassName="p-2">
        <ul className="divide-y divide-border/40">
          {exercicios.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 px-2 py-2.5">
              <span className="truncate">{e.nome}{e.grupo_muscular && <span className="font-mono text-xs text-muted-foreground"> · {e.grupo_muscular}</span>}</span>
              <span className="flex shrink-0 gap-1">
                <button
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
                  onClick={() => abrir(e)} aria-label="editar">
                  <Pencil className="size-3.5" />
                </button>
                <button
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  onClick={() => excluir(e)} aria-label="excluir">
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
          {exercicios.length === 0 && (
            <li className="px-2 py-6 text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Nenhum exercício ainda</li>
          )}
        </ul>
      </HudPanel>
    </div>
  );
}
