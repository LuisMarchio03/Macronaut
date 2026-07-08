import { useState } from "react";
import { Input } from "./ui/input";
import { useBuscaTaco } from "../hooks/use-taco";
import type { TacoItem } from "../domain/taco";

export function TacoAutocomplete({
  value, onChange, onSelecionar, id, placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelecionar: (item: TacoItem) => void;
  id?: string;
  placeholder?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const sugestoes = useBuscaTaco(value);
  const mostrar = aberto && value.trim().length > 0;

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 120)}
      />
      {mostrar && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border/60 bg-popover shadow-lg">
          {sugestoes.map((it, i) => (
            <li key={`${it.nome}-${i}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onSelecionar(it); setAberto(false); }}
              >
                {it.nome}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  · {Math.round(it.kcal)} kcal /100g
                </span>
              </button>
            </li>
          ))}
          {sugestoes.length === 0 && (
            <li className="px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
              Nada encontrado
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
