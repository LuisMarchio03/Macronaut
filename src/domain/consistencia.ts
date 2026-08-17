/**
 * "Estou seguindo a rotina?" — a pergunta que nenhuma tela respondia.
 *
 * Puro: recebe os dias da rotina e as datas em que houve treino, e devolve
 * números. Nada aqui conhece React, banco, nem o relógio — a data de hoje
 * entra como argumento, porque uma função que lê o relógio não se testa.
 */

const DIA_MS = 86_400_000;

/** Constrói a data no fuso local, como `lib/date.local`. Duplicado de
 *  propósito: `domain/` não importa de `lib/`, e a alternativa seria receber
 *  `Date` já construída em toda chamada. */
function local(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/** Dias inteiros entre duas datas "YYYY-MM-DD", positivo quando `fim` é depois. */
export function diasEntre(inicio: string, fim: string): number {
  return Math.round((local(fim).getTime() - local(inicio).getTime()) / DIA_MS);
}

export interface DiaDaRotina {
  id: number;
  dia_semana: number;
  nome: string;
}

export interface SessaoFeita {
  data: string;
  /** O dia da rotina a que a sessão pertenceu, quando houve um. */
  day_id: number | null;
}

export interface EstadoDoDia {
  dia: DiaDaRotina;
  /** Data da última vez que este dia foi treinado, ou `null` se nunca. */
  ultima: string | null;
  /** Dias desde a última vez. `null` quando nunca foi feito. */
  diasAtras: number | null;
}

/**
 * Por dia da rotina, quando foi a última vez.
 *
 * É o número que denuncia o dia que se vem pulando: "Perna: 11 dias" diz mais
 * do que qualquer média semanal.
 */
export function estadoDosDias(
  dias: DiaDaRotina[],
  sessoes: SessaoFeita[],
  hoje: string,
): EstadoDoDia[] {
  return dias.map((dia) => {
    const desteDia = sessoes
      .filter((s) => s.day_id === dia.id)
      .map((s) => s.data)
      .sort();
    const ultima = desteDia.at(-1) ?? null;
    return { dia, ultima, diasAtras: ultima === null ? null : diasEntre(ultima, hoje) };
  });
}

export interface SemanaTreinada {
  /** Domingo que abre a semana, "YYYY-MM-DD". */
  inicio: string;
  treinos: number;
}

/**
 * Treinos por semana nas últimas `quantas` semanas, da mais antiga para a mais
 * recente.
 *
 * A semana começa no domingo, para casar com `dia_semana` da rotina, onde
 * 0 é domingo. Duas sessões no mesmo dia contam como um treino: a pergunta é
 * "em quantos dias você treinou", não "quantas vezes abriu o app".
 */
export function treinosPorSemana(
  sessoes: SessaoFeita[],
  hoje: string,
  quantas = 4,
): SemanaTreinada[] {
  const d = local(hoje);
  const domingoDesta = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());

  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;

  const semanas: SemanaTreinada[] = [];
  for (let i = quantas - 1; i >= 0; i--) {
    const inicio = new Date(
      domingoDesta.getFullYear(),
      domingoDesta.getMonth(),
      domingoDesta.getDate() - i * 7,
    );
    const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
    const dentro = new Set(
      sessoes
        .filter((s) => {
          const t = local(s.data).getTime();
          return t >= inicio.getTime() && t <= fim.getTime();
        })
        .map((s) => s.data),
    );
    semanas.push({ inicio: iso(inicio), treinos: dentro.size });
  }
  return semanas;
}
