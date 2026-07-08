export type Granularidade = "semana" | "mes" | "ano" | "personalizado";
export type Periodo = { inicio: string; fim: string };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parse(data: string): Date {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d);
}
function fmt(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}
function addDias(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function rangeDoPeriodo(gran: Granularidade, ancora: string): Periodo {
  const d = parse(ancora);
  if (gran === "semana") {
    const offset = (d.getDay() + 6) % 7; // 0 = segunda
    const seg = addDias(d, -offset);
    return { inicio: fmt(seg), fim: fmt(addDias(seg, 6)) };
  }
  if (gran === "mes") {
    return {
      inicio: fmt(new Date(d.getFullYear(), d.getMonth(), 1)),
      fim: fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }
  if (gran === "ano") {
    return { inicio: `${d.getFullYear()}-01-01`, fim: `${d.getFullYear()}-12-31` };
  }
  return { inicio: ancora, fim: ancora };
}

export function navegar(gran: Granularidade, ancora: string, dir: -1 | 1): string {
  const d = parse(ancora);
  if (gran === "semana") return fmt(addDias(d, dir * 7));
  if (gran === "mes") return fmt(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  if (gran === "ano") return fmt(new Date(d.getFullYear() + dir, 0, 1));
  return ancora;
}

export function diasNoPeriodo(p: Periodo): number {
  const ms = parse(p.fim).getTime() - parse(p.inicio).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export function listaDeDias(p: Periodo): string[] {
  const dias: string[] = [];
  let cur = parse(p.inicio);
  const fim = parse(p.fim).getTime();
  while (cur.getTime() <= fim) {
    dias.push(fmt(cur));
    cur = addDias(cur, 1);
  }
  return dias;
}

export function rotuloPeriodo(gran: Granularidade, p: Periodo): string {
  const a = parse(p.inicio);
  const b = parse(p.fim);
  if (gran === "ano") return String(a.getFullYear());
  if (gran === "mes") return `${MESES_LONGOS[a.getMonth()]} ${a.getFullYear()}`;
  if (gran === "semana") {
    if (a.getMonth() === b.getMonth()) {
      return `${a.getDate()}–${b.getDate()} ${MESES[a.getMonth()]} ${a.getFullYear()}`;
    }
    return `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`;
  }
  const f = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${f(a)} – ${f(b)}`;
}
