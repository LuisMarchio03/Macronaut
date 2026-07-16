import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import type { Exercise } from "../../domain/types";
import { normalizar } from "../../domain/texto";

export function ExercicioAutocomplete({
  exercicios, selecionado, onSelecionar, id,
}: {
  exercicios: Exercise[];
  selecionado: Exercise | null;
  onSelecionar: (e: Exercise) => void;
  id?: string;
}) {
  const [texto, setTexto] = useState(selecionado?.nome ?? "");
  const [aberto, setAberto] = useState(false);

  // O fechamento por blur é adiado (o clique numa sugestão precisa acontecer
  // antes de a lista sumir), mas o timer tem que morrer se a busca for reaberta
  // nesse meio-tempo: sem isso, um blur antigo fecha a lista por baixo de uma
  // seleção nova e engole o toque (ex.: gravar série e trocar de exercício
  // rápido no celular).
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelarFechamento() {
    if (fecharTimer.current !== null) {
      clearTimeout(fecharTimer.current);
      fecharTimer.current = null;
    }
  }

  function agendarFechamento() {
    cancelarFechamento();
    fecharTimer.current = setTimeout(() => {
      fecharTimer.current = null;
      setAberto(false);
    }, 120);
  }

  useEffect(() => cancelarFechamento, []);

  // O pai pode trocar a seleção (ex.: ao limpar o formulário depois de gravar).
  useEffect(() => { setTexto(selecionado?.nome ?? ""); }, [selecionado]);

  const busca = normalizar(texto);
  const sugestoes =
    busca.length === 0 ? exercicios : exercicios.filter((e) => normalizar(e.nome).includes(busca));
  const mostrar = aberto;

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={mostrar}
        autoComplete="off"
        placeholder="Buscar exercício…"
        value={texto}
        onChange={(e) => { cancelarFechamento(); setTexto(e.target.value); setAberto(true); }}
        onFocus={() => { cancelarFechamento(); setAberto(true); }}
        onBlur={agendarFechamento}
      />
      {mostrar && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border/60 bg-popover shadow-lg">
          {sugestoes.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => { cancelarFechamento(); onSelecionar(e); setTexto(e.nome); setAberto(false); }}
              >
                <span className="truncate">{e.nome}</span>
                <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">
                  {e.grupo_nome ?? "sem grupo"}
                  {e.source === "custom" && " · seu"}
                </span>
              </button>
            </li>
          ))}
          {sugestoes.length === 0 && (
            <li className="px-3 py-3 text-center font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
              Nenhum exercício
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
