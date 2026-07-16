import { useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { HudPanel } from "../ui/hud-panel";
import {
  useExercises, useCreateExercise, useUpdateExercise, useDeleteExercise,
} from "../../hooks/use-exercises";
import { useMuscleGroups } from "../../hooks/use-muscle-groups";
import type { Exercise } from "../../domain/types";

export function ExerciciosTab() {
  const { data: exercicios = [] } = useExercises();
  const { data: grupos = [] } = useMuscleGroups();
  const criar = useCreateExercise();
  const atualizar = useUpdateExercise();
  const remover = useDeleteExercise();
  const [editando, setEditando] = useState<Exercise | "novo" | null>(null);
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [aviso, setAviso] = useState("");

  function abrir(e: Exercise | "novo") {
    setEditando(e);
    setNome(e === "novo" ? "" : e.nome);
    setGrupoId(e === "novo" ? "" : e.grupo_id != null ? String(e.grupo_id) : "");
    setAviso("");
  }

  async function salvar() {
    if (!nome.trim()) return;
    const dados = { nome: nome.trim(), grupo_id: grupoId ? Number(grupoId) : null };
    if (editando === "novo") await criar.mutateAsync(dados);
    else if (editando) {
      const r = await atualizar.mutateAsync({ id: editando.id, e: dados });
      if (!r.ok) { setAviso(`"${nome}" não pode ser editado.`); return; }
    }
    setEditando(null);
  }

  async function excluir(e: Exercise) {
    const r = await remover.mutateAsync(e.id);
    if (r.ok) { setAviso(""); return; }
    setAviso(
      r.reason === "em_uso"
        ? `"${e.nome}" está em uso e não pode ser excluído.`
        : `"${e.nome}" é do catálogo e não pode ser excluído.`,
    );
  }

  if (editando) {
    return (
      <HudPanel
        label={editando === "novo" ? "Novo exercício" : "Editar exercício"}
        bodyClassName="space-y-3"
      >
        <div><Label htmlFor="ex-nome">Nome</Label>
          <Input id="ex-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><Label htmlFor="ex-grupo">Grupo muscular</Label>
          <select id="ex-grupo" className="hud-select"
            value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">Sem grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select></div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
          <Button className="flex-1" onClick={salvar} disabled={!nome.trim()}>Salvar</Button>
        </div>
      </HudPanel>
    );
  }

  // Pendentes primeiro: são os que o backfill não conseguiu casar e que ficam
  // fora da análise até o usuário resolver.
  const ordenados = [...exercicios].sort((a, b) => {
    const pa = a.grupo_id == null ? 0 : 1;
    const pb = b.grupo_id == null ? 0 : 1;
    return pa !== pb ? pa - pb : a.nome.localeCompare(b.nome);
  });
  const nPendentes = exercicios.filter((e) => e.grupo_id == null).length;

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
      {nPendentes > 0 && (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          {nPendentes} {nPendentes === 1 ? "exercício está" : "exercícios estão"} sem grupo muscular
          e <b>{nPendentes === 1 ? "fica" : "ficam"} fora da análise</b> até você escolher um.
        </p>
      )}
      {aviso && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {aviso}
        </p>
      )}
      <HudPanel label="Exercícios" aside={`${exercicios.length}`} bodyClassName="p-2">
        <ul className="divide-y divide-border/40">
          {ordenados.map((e) => (
            <li key={e.id} aria-label={e.nome} className="flex items-center justify-between gap-2 px-2 py-2.5">
              <span className="truncate">
                {e.nome}
                <span className={`font-mono text-xs ${e.grupo_id == null ? "text-primary" : "text-muted-foreground"}`}>
                  {" · "}{e.grupo_nome ?? "sem grupo"}
                </span>
                {e.source === "catalogo" && (
                  <span className="font-mono text-xs text-muted-foreground"> · catálogo</span>
                )}
              </span>
              {e.source === "custom" && (
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
              )}
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
