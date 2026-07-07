import { useState } from "react";
import { TreinoTab } from "../components/treino/treino-tab";
import { CardioTab } from "../components/treino/cardio-tab";
import { ProgressaoTab } from "../components/treino/progressao-tab";
import { ExerciciosTab } from "../components/treino/exercicios-tab";

const ABAS = [
  { key: "treino", label: "Treino" },
  { key: "cardio", label: "Cardio" },
  { key: "progressao", label: "Progressão" },
  { key: "exercicios", label: "Exercícios" },
] as const;

type AbaKey = (typeof ABAS)[number]["key"];

export function Treino() {
  const [aba, setAba] = useState<AbaKey>("treino");
  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-1">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-primary/70">
          Módulo · treino
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Treino</h1>
      </header>
      <div
        role="tablist"
        className="grid grid-cols-4 gap-1 rounded-xl border border-border/60 bg-card/50 p-1 backdrop-blur-md"
      >
        {ABAS.map((a) => (
          <button
            key={a.key}
            role="tab"
            aria-selected={aba === a.key}
            className={`rounded-lg px-2 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] transition-colors ${
              aba === a.key
                ? "bg-primary font-semibold text-primary-foreground shadow-[0_0_16px_-4px_var(--primary)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setAba(a.key)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {aba === "treino" && <TreinoTab />}
      {aba === "cardio" && <CardioTab />}
      {aba === "progressao" && <ProgressaoTab />}
      {aba === "exercicios" && <ExerciciosTab />}
    </div>
  );
}
