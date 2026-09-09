import { useEffect, useState } from "react";

/**
 * Quanto tempo passou, para ler de relance no meio de uma série.
 *
 * Não é `mm:ss`: o número que importa num treino é "faz meia hora", não o
 * segundo — e um contador piscando no rodapé disputaria atenção com o
 * cronômetro de descanso, que é onde os segundos de fato contam.
 *
 * O piso em zero cobre o relógio andando para trás (fuso, ajuste de horário,
 * `iniciado_em` gravado por um aparelho adiantado). "faz -3 min" não é uma
 * informação, é um defeito visível.
 */
export function formatarDecorrido(ms: number): string {
  const min = Math.floor(Math.max(ms, 0) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

/**
 * O tempo desde um instante ISO, ticando de segundo em segundo.
 *
 * Nada é persistido: o relógio de parede é a fonte, então fechar o app e
 * voltar duas horas depois dá o número certo sem nenhum estado salvo. É o
 * princípio do `fimTs` do `CronometroDescanso` — aquele precisa do
 * `localStorage` porque o alvo é uma escolha do usuário, e esta função deriva
 * de uma coluna do banco, que já sobreviveu ao app fechar.
 *
 * Sem `desde` não há intervalo: sem treino em curso a faixa não existe, e um
 * tique por segundo seria trabalho para ninguém ver.
 */
export function useTempoDecorrido(desde: string | null): string | null {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (desde === null) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [desde]);

  if (desde === null) return null;
  const inicio = Date.parse(desde);
  if (Number.isNaN(inicio)) return null;
  return formatarDecorrido(agora - inicio);
}
