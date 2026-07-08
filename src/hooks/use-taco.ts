import { useEffect, useMemo, useState } from "react";
import { buscarTaco, type TacoItem } from "../domain/taco";

let cache: TacoItem[] | null = null;
let carregando: Promise<TacoItem[]> | null = null;

function carregarTaco(): Promise<TacoItem[]> {
  if (cache) return Promise.resolve(cache);
  if (!carregando) {
    carregando = import("../data/taco.json")
      .then((m) => (cache = (m.default as TacoItem[])))
      .catch(() => (cache = []));
  }
  return carregando;
}

export function useBuscaTaco(termo: string): TacoItem[] {
  const [itens, setItens] = useState<TacoItem[]>(cache ?? []);
  useEffect(() => {
    let vivo = true;
    carregarTaco().then((d) => vivo && setItens(d));
    return () => {
      vivo = false;
    };
  }, []);
  return useMemo(() => buscarTaco(itens, termo), [itens, termo]);
}
