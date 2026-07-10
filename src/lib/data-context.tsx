import { createContext, useContext, useState, type ReactNode } from "react";
import { hoje } from "./date";

type DataCtx = {
  data: string;
  setData: (iso: string) => void;
  ehHoje: boolean;
  irHoje: () => void;
  passoDia: (delta: -1 | 1) => void;
};

const Ctx = createContext<DataCtx | null>(null);

// Soma dias em cima da data local (mesma convenção de `hoje()`), evitando
// drift de fuso que aconteceria via UTC/toISOString.
function somaDias(iso: string, delta: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d + delta);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function DataProvider({ children, dataInicial }: { children: ReactNode; dataInicial?: string }) {
  const [data, setDataRaw] = useState(() => {
    const v = dataInicial ?? hoje();
    return v > hoje() ? hoje() : v;
  });
  const setData = (iso: string) => setDataRaw(iso > hoje() ? hoje() : iso);
  const value: DataCtx = {
    data,
    setData,
    ehHoje: data === hoje(),
    irHoje: () => setDataRaw(hoje()),
    passoDia: (delta) => setData(somaDias(data, delta)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDataAtiva(): DataCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDataAtiva precisa de DataProvider");
  return v;
}
