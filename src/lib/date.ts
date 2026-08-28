export function hoje(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Constrói a data no fuso local. `new Date("2026-08-14")` seria interpretada
 *  como UTC e, a oeste de Greenwich, cairia no dia anterior. */
function local(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/** "Quinta, 14 de agosto" — o cabeçalho do dia. */
export function dataPorExtenso(data: string): string {
  const d = local(data);
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "Hoje" / "Ontem" / "Amanhã" quando cabe; senão, a data por extenso. */
export function dataRelativa(data: string): string {
  const diff = Math.round(
    (local(data).getTime() - local(hoje()).getTime()) / 86_400_000,
  );
  if (diff === 0) return "Hoje";
  if (diff === -1) return "Ontem";
  if (diff === 1) return "Amanhã";
  return dataPorExtenso(data);
}

/** Dia da semana de "YYYY-MM-DD": 0 = domingo. Usa `local` de propósito —
 *  `new Date(data).getDay()` leria a string como UTC e, a oeste de Greenwich,
 *  responderia o dia anterior. */
export function diaSemana(data: string): number {
  return local(data).getDay();
}

/** Minutos desde a meia-noite, de "HH:MM". NaN vira null para não contaminar
 *  comparações de horário com um valor que é sempre falso em toda comparação. */
export function horaParaMinutos(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutos desde a meia-noite agora. */
export function minutosAgora(agora: Date = new Date()): number {
  return agora.getHours() * 60 + agora.getMinutes();
}

/** "07:00" → "7h", "07:30" → "7h30". */
export function horaCurta(hhmm: string | null | undefined): string {
  const min = horaParaMinutos(hhmm);
  if (min === null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** "7h – 8h" a partir de início e fim; só o início quando não há fim. */
export function janelaHoraria(
  inicio: string | null | undefined,
  fim: string | null | undefined,
): string {
  const a = horaCurta(inicio);
  const b = horaCurta(fim);
  if (a && b) return `${a} – ${b}`;
  return a || b || "";
}

/**
 * A data de `n` dias atrás, em "YYYY-MM-DD".
 *
 * Constrói no fuso local e deixa o `Date` normalizar a virada de mês e de ano:
 * subtrair do número do dia à mão é onde a aritmética de data costuma quebrar.
 */
export function diasAtras(data: string, n: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
