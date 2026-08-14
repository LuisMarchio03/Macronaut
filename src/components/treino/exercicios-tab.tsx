import { useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
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
      <Card
        header={editando === "novo" ? "Novo exercício" : "Editar exercício"}
        bodyClassName="space-y-3 px-4 pt-1 pb-4"
      >
        <div><Label htmlFor="ex-nome">Nome</Label>
          <Input id="ex-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><Label htmlFor="ex-grupo">Grupo muscular</Label>
          <select id="ex-grupo" className="select-field"
            value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
            <option value="">Sem grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setEditando(null)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!nome.trim()}>
            Salvar
          </Button>
        </div>
      </Card>
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
        <h2 className="t-section">
          Biblioteca
        </h2>
        <Button size="sm" onClick={() => abrir("novo")}>
          <Plus className="size-4" /> Novo exercício
        </Button>
      </div>
      {nPendentes > 0 && (
        <p className="rounded-md border border-primary/30 bg-tint-primary px-3 py-2 text-sm">
          {nPendentes} {nPendentes === 1 ? "exercício está" : "exercícios estão"} sem grupo muscular
          e <b>{nPendentes === 1 ? "fica" : "ficam"} fora da análise</b> até você escolher um.
        </p>
      )}
      {aviso && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-tint-danger px-3 py-2 text-sm text-destructive">
          {aviso}
        </p>
      )}
      <Card
        header="Exercícios"
        aside={exercicios.length > 0 ? String(exercicios.length) : undefined}
        padded={false}
      >
        {exercicios.length > 0 ? (
          <ul className="divide-y divide-border">
            {ordenados.map((e) => (
              <li key={e.id} aria-label={e.nome} className="flex items-center gap-1 px-4 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.nome}</span>
                  <span
                    className={
                      e.grupo_id == null
                        ? "block truncate text-[0.8125rem] text-primary"
                        : "t-caption block truncate"
                    }
                  >
                    {e.grupo_nome ?? "sem grupo muscular"}
                    {e.source === "catalogo" && " · catálogo"}
                  </span>
                </span>
                {e.source === "custom" && (
                  <>
                    <button
                      type="button"
                      onClick={() => abrir(e)}
                      aria-label={`Editar ${e.nome}`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluir(e)}
                      aria-label={`Excluir ${e.nome}`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-danger hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-caption px-4 pt-1 pb-4">Nenhum exercício cadastrado ainda.</p>
        )}
      </Card>
    </div>
  );
}
