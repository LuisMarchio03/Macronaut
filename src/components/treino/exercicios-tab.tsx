import { useMemo, useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { SheetConfirmar } from "../ui/confirmar";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SheetExercicio } from "./sheet-exercicio";
import { SheetExercicioForm } from "./sheet-exercicio-form";
import {
  useExercises, useCreateExercise, useUpdateExercise, useDeleteExercise,
} from "../../hooks/use-exercises";
import { useMuscleGroups } from "../../hooks/use-muscle-groups";
import { casaBusca } from "../../domain/treino";
import type { Exercise } from "../../domain/types";

/**
 * Falta grupo muscular a este exercício?
 *
 * Cardio fica de fora: ele não tem grupo POR DESIGN (ver `seedExerciciosDeCardio`)
 * e vem do catálogo, então o usuário nem poderia corrigir. Contá-lo como
 * pendente produzia um aviso permanente e sem ação possível — "12 exercícios
 * estão sem grupo muscular" num app onde nenhum dos 12 pode ganhar um.
 */
function ehPendente(e: Exercise): boolean {
  return e.grupo_id == null && e.equipamento !== "cardio";
}

/** O que a linha diz do exercício abaixo do nome. */
function descricaoDe(e: Exercise): string {
  if (e.grupo_nome) return e.grupo_nome;
  return e.equipamento === "cardio" ? "Cardio" : "sem grupo muscular";
}

/**
 * A biblioteca de exercícios.
 *
 * Com uma dúzia de itens a lista era o conteúdo e bastava rolar. Com o
 * catálogo cheio ela é palha: por isso a busca (que casa apelido, porque
 * ninguém procura "Supino reto com barra" — procura "supino") e o filtro por
 * grupo vêm antes da lista, não depois.
 */
export function ExerciciosTab() {
  const { data: exercicios = [] } = useExercises();
  const { data: grupos = [] } = useMuscleGroups();
  const criar = useCreateExercise();
  const atualizar = useUpdateExercise();
  const remover = useDeleteExercise();

  const [busca, setBusca] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");
  const [vendo, setVendo] = useState<Exercise | null>(null);
  const [editando, setEditando] = useState<Exercise | "novo" | null>(null);
  const [excluindo, setExcluindo] = useState<Exercise | null>(null);
  const [aviso, setAviso] = useState("");

  const nPendentes = exercicios.filter(ehPendente).length;

  // Pendentes primeiro: são os que o backfill não conseguiu casar e que ficam
  // fora da análise até o usuário resolver.
  const visiveis = useMemo(() => {
    return exercicios
      .filter((e) => casaBusca(e.nome, e.aliases, busca))
      .filter((e) => grupoFiltro === "" || e.grupo_nome === grupoFiltro)
      .sort((a, b) => {
        const pa = ehPendente(a) ? 0 : 1;
        const pb = ehPendente(b) ? 0 : 1;
        return pa !== pb ? pa - pb : a.nome.localeCompare(b.nome);
      });
  }, [exercicios, busca, grupoFiltro]);

  async function salvar(dados: Parameters<typeof criar.mutateAsync>[0]) {
    if (editando === "novo") await criar.mutateAsync(dados);
    else if (editando) {
      const r = await atualizar.mutateAsync({ id: editando.id, e: dados });
      if (!r.ok) setAviso(`"${dados.nome}" não pode ser editado.`);
    }
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

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor="ex-busca">Buscar exercício</Label>
          <Input
            id="ex-busca"
            value={busca}
            placeholder="supino, agachamento…"
            autoComplete="off"
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button onClick={() => setEditando("novo")}>
          <Plus className="size-4" /> Novo exercício
        </Button>
      </div>

      <div>
        <Label htmlFor="ex-filtro">Filtrar por grupo</Label>
        <select
          id="ex-filtro"
          className="select-field"
          value={grupoFiltro}
          onChange={(e) => setGrupoFiltro(e.target.value)}
        >
          <option value="">Todos os grupos</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.nome}>
              {g.nome}
            </option>
          ))}
        </select>
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
        aside={visiveis.length > 0 ? String(visiveis.length) : undefined}
        padded={false}
      >
        {visiveis.length > 0 ? (
          <ul className="divide-y divide-border">
            {visiveis.map((e) => (
              <li key={e.id} aria-label={e.nome} className="flex items-center gap-1 pr-2 pl-2">
                <button
                  type="button"
                  onClick={() => setVendo(e)}
                  aria-label={`Ver ficha de ${e.nome}`}
                  className="min-h-12 min-w-0 flex-1 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="block truncate text-sm font-medium">{e.nome}</span>
                  <span
                    className={
                      ehPendente(e)
                        ? "block truncate text-[0.8125rem] text-primary"
                        : "t-caption block truncate"
                    }
                  >
                    {descricaoDe(e)}
                    {e.source === "catalogo" && " · catálogo"}
                  </span>
                </button>
                {e.source === "custom" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditando(e)}
                      aria-label={`Editar ${e.nome}`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcluindo(e)}
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
        ) : exercicios.length === 0 ? (
          <p className="t-caption px-4 pt-1 pb-4">Nenhum exercício cadastrado ainda.</p>
        ) : (
          <p className="t-caption px-4 pt-1 pb-4">
            Nenhum exercício encontrado. Ajuste a busca ou o filtro — ou cadastre este como seu.
          </p>
        )}
      </Card>

      <SheetExercicio aberto={vendo !== null} onFechar={() => setVendo(null)} exercicio={vendo} />

      <SheetExercicioForm
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        exercicio={editando === "novo" ? null : editando}
        grupos={grupos}
        onSalvar={salvar}
      />

      <SheetConfirmar
        aberto={excluindo !== null}
        onFechar={() => setExcluindo(null)}
        titulo={`Excluir "${excluindo?.nome ?? ""}"?`}
        descricao="O exercício sai da sua biblioteca. Se ele já tem série registrada, a exclusão é recusada."
        onConfirmar={() => {
          if (excluindo) excluir(excluindo);
        }}
      />
    </div>
  );
}
