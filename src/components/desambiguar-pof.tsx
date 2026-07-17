import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { useCandidatos, useResolverCandidatas } from "../hooks/use-food-measures";
import { formatarNumero } from "../domain/medidas";
import { normalizar } from "../domain/texto";
import { qualificadoresTaco } from "../domain/matching-pof";
import type { FoodUnit } from "../domain/types";

const VISIVEIS = 5; // mostra os 5 primeiros; o resto atrás de "ver todas"

type Candidato = { pof_codigo: string; pof_descricao: string | null; medidas: { nome: string; qty_base: number }[] };

/**
 * Ordena os candidatos por relevância de leitura: os que mais mencionam os
 * qualificadores do nome da TACO ("bovina", "acém") na descrição da POF vêm
 * primeiro. Só isso — não decide nada, o usuário ainda escolhe. É o que faz os
 * "5 primeiros" serem os 5 mais prováveis, não os 5 primeiros por ordem de
 * código.
 */
function ordenarPorRelevancia(candidatos: Candidato[], foodNome: string): Candidato[] {
  const quals = qualificadoresTaco(foodNome);
  if (quals.length === 0) return candidatos;
  const batidas = (c: Candidato) => {
    const d = normalizar(c.pof_descricao ?? "");
    return quals.filter((q) => d.includes(q)).length;
  };
  // estável: empate mantém a ordem que veio do repositório (código, ordem)
  return candidatos
    .map((c, i) => ({ c, i, n: batidas(c) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.c);
}

/**
 * Desambiguação preguiçosa (spec, D3). A pergunta é qual ALIMENTO da POF
 * corresponde a este alimento da TACO — não qual medida usar hoje. Escolher
 * "concha 140 g" não valeria nada se a concha viesse do feijão errado.
 *
 * Acontece uma vez por alimento, na 1ª vez que ele é registrado. O rótulo é o
 * nome cru da POF ("FEIJAO CARIOCA · CROZIDO(A)") — feio, mas é exatamente a
 * informação que permite decidir; as medidas vêm embaixo como confirmação.
 */
export function DesambiguarPof({
  foodId, foodNome, baseUnit, onResolvido,
}: {
  foodId: number;
  foodNome: string;
  baseUnit: FoodUnit;
  onResolvido: () => void;
}) {
  const { data: candidatos = [] } = useCandidatos(foodId);
  const resolver = useResolverCandidatas();
  const [verTodas, setVerTodas] = useState(false);

  async function escolher(pofCodigo: string | null) {
    await resolver.mutateAsync({ foodId, pofCodigo });
    onResolvido();
  }

  // Mesmo com o estreitamento por qualificador (Task 5), a cauda vai até 35
  // candidatos. Uma parede de 35 botões não é uma escolha — ordena por
  // relevância e mostra 5 + "ver todas".
  const ordenados = useMemo(() => ordenarPorRelevancia(candidatos, foodNome), [candidatos, foodNome]);
  const mostrados = verTodas ? ordenados : ordenados.slice(0, VISIVEIS);
  const ocultos = ordenados.length - mostrados.length;

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">{foodNome}</p>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
          Qual destes é, na tabela do IBGE?
        </p>
      </div>

      <ul className="space-y-1.5">
        {mostrados.map((c) => (
          <li key={c.pof_codigo}>
            <button
              type="button"
              onClick={() => escolher(c.pof_codigo)}
              disabled={resolver.isPending}
              className="w-full rounded-lg border border-border/60 px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-muted/50"
            >
              <span className="block text-sm">{c.pof_descricao ?? "(sem descrição)"}</span>
              <span className="mt-0.5 block font-mono text-[0.72rem] tabular-nums text-muted-foreground">
                {c.medidas.map((m) => `${m.nome} ${formatarNumero(m.qty_base)} ${baseUnit}`).join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {ocultos > 0 && (
        <button
          type="button"
          onClick={() => setVerTodas(true)}
          className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-primary/80 hover:text-primary"
        >
          ver todas as {candidatos.length}
        </button>
      )}

      <Button variant="secondary" size="sm" onClick={() => escolher(null)} disabled={resolver.isPending}>
        Nenhum destes · digitar em {baseUnit}
      </Button>
    </div>
  );
}
