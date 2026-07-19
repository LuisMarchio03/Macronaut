import { useState } from "react";
import { Dumbbell, ChartNoAxesCombined } from "lucide-react";
import { TreinoTab } from "../components/treino/treino-tab";
import { CardioTab } from "../components/treino/cardio-tab";
import { ProgressaoTab } from "../components/treino/progressao-tab";
import { ExerciciosTab } from "../components/treino/exercicios-tab";
import { DateNav } from "../components/date-nav";

type AbaKey = "treino" | "progression";

export function Treino() {
  const [aba, setAba] = useState<AbaKey>("treino");
  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-2">
        <p className="section-title">Treino</p>
        <h1 className="text-2xl font-semibold tracking-tight">Treino</h1>
        <div className="pt-1"><DateNav /></div>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/50 bg-card p-1">
        <button
          type="button"
          onClick={() => setAba("treino")}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
            aba === "treino"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Dumbbell className="size-4" /> Treino
        </button>
        <button
          type="button"
          onClick={() => setAba("progression")}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
            aba === "progression"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ChartNoAxesCombined className="size-4" /> Progressão
        </button>
      </div>

      {aba === "treino" && (
        <div className="space-y-4">
          <TreinoTab />
          <div className="border-t border-border/40 pt-4">
            <p className="section-title mb-3 px-1">Cardio</p>
            <CardioTab />
          </div>
        </div>
      )}

      {aba === "progression" && (
        <div className="space-y-4">
          <ProgressaoTab />
          <div className="border-t border-border/40 pt-4">
            <p className="section-title mb-3 px-1">Biblioteca de exercícios</p>
            <ExerciciosTab />
          </div>
        </div>
      )}
    </div>
  );
}