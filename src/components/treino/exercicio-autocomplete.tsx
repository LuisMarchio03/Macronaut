import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import type { ExerciseSource } from "../../domain/types";
import { casaBusca } from "../../domain/treino";

/**
 * O mínimo para um exercício ser buscável aqui.
 *
 * Estrutural, e não `Exercise` inteiro: a calistenia lista os exercícios com
 * uma projeção própria (só o que a busca usa), e exigir o registro completo
 * obrigaria a inventar `created_at` e `grupo_muscular` só para chamar a busca.
 * `Exercise` satisfaz este formato, então quem já passava um continua passando.
 */
export interface ExercicioBuscavel {
  id: number;
  nome: string;
  aliases: string | null;
  grupo_nome: string | null;
  source: ExerciseSource;
}

export function ExercicioAutocomplete<T extends ExercicioBuscavel>({
  exercicios, selecionado, onSelecionar, id,
}: {
  exercicios: T[];
  selecionado: T | null;
  onSelecionar: (e: T) => void;
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

  // `casaBusca` e não só o nome: ninguém digita "Supino reto com barra" no
  // meio de um treino — digita "supino", ou "bench". Sem os apelidos, um
  // catálogo de 170 é um catálogo em que você não acha o que procura.
  const sugestoes = exercicios.filter((e) => casaBusca(e.nome, e.aliases, texto));
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
                <span className="shrink-0 t-caption">
                  {e.grupo_nome ?? "sem grupo"}
                  {e.source === "custom" && " · seu"}
                </span>
              </button>
            </li>
          ))}
          {sugestoes.length === 0 && (
            <li className="px-3 py-3 text-center t-caption">
              Nenhum exercício
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
