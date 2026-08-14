import { useState } from "react";
import { Dumbbell, ChartNoAxesCombined } from "lucide-react";
import { Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { Segmented } from "@/components/ui/segmented";
import { TreinoTab } from "../components/treino/treino-tab";
import { CardioTab } from "../components/treino/cardio-tab";
import { ProgressaoTab } from "../components/treino/progressao-tab";
import { ExerciciosTab } from "../components/treino/exercicios-tab";
import { DateNav } from "../components/date-nav";

type AbaKey = "treino" | "progressao";

const ABAS = [
  { valor: "treino" as const, label: "Treino", icone: Dumbbell },
  { valor: "progressao" as const, label: "Progressão", icone: ChartNoAxesCombined },
];

export function Treino() {
  const [aba, setAba] = useState<AbaKey>("treino");

  return (
    <Page>
      <PageHeader title="Treino">
        <DateNav />
      </PageHeader>

      <Segmented opcoes={ABAS} valor={aba} onChange={setAba} rotulo="Visão do treino" />

      {aba === "treino" ? (
        <>
          <TreinoTab />
          <div className="space-y-2">
            <SectionLabel>Cardio</SectionLabel>
            <CardioTab />
          </div>
        </>
      ) : (
        <>
          <ProgressaoTab />
          <div className="space-y-2">
            <SectionLabel>Biblioteca de exercícios</SectionLabel>
            <ExerciciosTab />
          </div>
        </>
      )}
    </Page>
  );
}
