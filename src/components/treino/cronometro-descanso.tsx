import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const PADRAO_S = 150;
const PASSO_S = 15;
const CHAVE = "macronaut.descanso";
const CHAVE_SOM = "macronaut.descanso.som";

interface DescansoSalvo {
  sessionId: number;
  alvo: number;
  /** Instante do relógio de parede em que zera. `null` quando pausado. */
  fimTs: number | null;
  rodando: boolean;
  restante: number;
}

function mmss(s: number): string {
  const m = Math.floor(Math.abs(s) / 60);
  const seg = Math.abs(s) % 60;
  return `${s < 0 ? "+" : ""}${m}:${String(seg).padStart(2, "0")}`;
}

/**
 * O que estava contando quando o app fechou.
 *
 * Tudo em `try/catch`: navegador anônimo, armazenamento bloqueado e JSON
 * corrompido são três jeitos de o `localStorage` explodir, e nenhum deles pode
 * derrubar a tela da academia.
 */
function ler(sessionId: number): DescansoSalvo | null {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return null;
    const s = JSON.parse(cru) as DescansoSalvo;
    return s.sessionId === sessionId && typeof s.alvo === "number" ? s : null;
  } catch {
    return null;
  }
}

function gravar(s: DescansoSalvo): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(s));
  } catch {
    /* sem persistência é degradação aceitável; sem tela, não. */
  }
}

function lerSom(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== "0";
  } catch {
    return true;
  }
}

/**
 * Avisa que o descanso acabou, com o que o navegador der.
 *
 * Sem notificação de segundo plano de propósito: o app não roda lá, e um
 * alarme prometido que não toca é pior do que alarme nenhum. Vibração e bipe
 * valem enquanto a tela está aberta, que é quando você está olhando para ela.
 */
function avisar(): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* iOS não tem, e alguns navegadores exigem gesto recente. */
  }
  try {
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.frequency.value = 880;
    // Rampa em vez de corte seco: um oscilador que para de repente estala.
    ganho.gain.setValueAtTime(0.001, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(ganho).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => void ctx.close().catch(() => {});
  } catch {
    /* áudio bloqueado por falta de gesto do usuário: a vibração já foi. */
  }
}

/**
 * Descanso entre séries.
 *
 * Conta para baixo e **continua contando depois do zero**, em vez de parar:
 * saber que já se passaram 4:30 quando o alvo era 2:30 é informação; um
 * "00:00" congelado não é.
 *
 * Três coisas que ele já errou:
 *
 * **`chave = 0` é ocioso**, e não "primeira montagem". A guarda anterior era um
 * `useRef` que pulava o primeiro efeito — e como o componente só era montado
 * DEPOIS da primeira série, era exatamente o primeiro descanso que nascia
 * parado. Em desenvolvimento o StrictMode roda o efeito duas vezes e escondia
 * o bug; em produção, não. O critério agora é um dado ("houve série?"), não a
 * ordem em que o React chamou o efeito.
 *
 * **O tempo mora no relógio de parede** (`fimTs`), não num contador que
 * decrementa. Um `setInterval` não roda com a aba em segundo plano nem com o
 * app fechado, então voltar depois de três minutos mostrava o mesmo número de
 * quando você saiu. Guardar o instante em que zera faz a conta continuar certa
 * sozinha.
 *
 * **Ele fica na tela a sessão inteira**, ocioso até a primeira série. Antes só
 * existia depois dela, e não havia como cronometrar um aquecimento.
 */
export function CronometroDescanso({
  chave,
  segundos = PADRAO_S,
  sessionId,
  agora = () => Date.now(),
}: {
  /** Muda a cada série registrada; reinicia a contagem. `0` = ninguém registrou ainda. */
  chave: number;
  segundos?: number;
  /** O descanso pertence a uma sessão: retomar outra não herda o relógio dela. */
  sessionId: number;
  /** Injetável para o teste; em produção é sempre o relógio. */
  agora?: () => number;
}) {
  const salvo = useRef<DescansoSalvo | null>(null);
  if (salvo.current === null) salvo.current = ler(sessionId) ?? { sessionId, alvo: segundos, fimTs: null, rodando: false, restante: segundos };

  const [alvo, setAlvo] = useState(salvo.current.alvo);
  const [fimTs, setFimTs] = useState<number | null>(salvo.current.fimTs);
  const [rodando, setRodando] = useState(salvo.current.rodando);
  const [restante, setRestante] = useState(() =>
    salvo.current!.rodando && salvo.current!.fimTs !== null
      ? Math.round((salvo.current!.fimTs - agora()) / 1000)
      : salvo.current!.restante,
  );
  const [som, setSom] = useState(lerSom);

  /** Já avisou neste descanso? Zera a cada reinício. */
  const avisou = useRef(restante < 0);
  /**
   * Nunca foi tocado nesta sessão.
   *
   * É o que separa "ocioso porque ainda não começou" de "ocioso porque você
   * pausou": sem essa distinção, voltar à tela com um descanso pausado no
   * meio o reescrevia com o alvo do exercício e perdia o que estava contado.
   */
  const virgem = useRef(
    !salvo.current.rodando && salvo.current.fimTs === null && salvo.current.restante === salvo.current.alvo,
  );
  /** A primeira montagem não deve reagir a `chave`; só as mudanças dela. */
  const chaveAnterior = useRef(chave);

  const reiniciar = useCallback(
    (novoAlvo: number) => {
      virgem.current = false;
      setAlvo(novoAlvo);
      setRestante(novoAlvo);
      setFimTs(agora() + novoAlvo * 1000);
      setRodando(true);
      avisou.current = false;
    },
    [agora],
  );

  // Uma série registrada reinicia o descanso. `chave === 0` é o estado ocioso
  // de quem ainda não registrou nada — e ocioso não conta.
  useEffect(() => {
    if (chave === chaveAnterior.current) return;
    chaveAnterior.current = chave;
    if (chave === 0) return;
    reiniciar(segundos);
  }, [chave, segundos, reiniciar]);

  // Ocioso e intocado, o mostrador acompanha o descanso do exercício da vez:
  // trocar de exercício sem ter registrado série ainda deve mostrar o descanso
  // DELE.
  useEffect(() => {
    if (!virgem.current || rodando || chave !== 0) return;
    setAlvo(segundos);
    setRestante(segundos);
  }, [segundos, rodando, chave]);

  useEffect(() => {
    if (!rodando || fimTs === null) return;
    const tick = () => setRestante(Math.round((fimTs - agora()) / 1000));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [rodando, fimTs, agora]);

  // O aviso é do cruzamento do zero, não de "está negativo": sem isso ele
  // dispararia a cada tick do tempo estourado.
  useEffect(() => {
    if (!rodando || restante >= 0 || avisou.current) return;
    avisou.current = true;
    if (som) avisar();
  }, [restante, rodando, som]);

  useEffect(() => {
    gravar({ sessionId, alvo, fimTs, rodando, restante });
  }, [sessionId, alvo, fimTs, rodando, restante]);

  function alternar() {
    virgem.current = false;
    if (rodando) {
      setRodando(false);
      setFimTs(null);
      return;
    }
    setFimTs(agora() + restante * 1000);
    setRodando(true);
  }

  function ajustar(delta: number) {
    virgem.current = false;
    const novo = Math.max(PASSO_S, alvo + delta);
    setAlvo(novo);
    // Rodando, o ajuste move o fim; parado, move o mostrador. Nos dois casos
    // ele vale para os próximos descansos deste exercício.
    if (rodando && fimTs !== null) {
      setFimTs(fimTs + delta * 1000);
      avisou.current = false;
    } else {
      setRestante(novo);
    }
  }

  const estourou = restante < 0;

  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="t-caption shrink-0">Descanso</span>
        <span
          aria-live="off"
          aria-label={`Descanso: ${mmss(restante)}`}
          className={cn(
            "min-w-[3.5rem] text-lg font-bold tabular-nums",
            estourou && "text-warning",
          )}
        >
          {mmss(restante)}
        </span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => ajustar(-PASSO_S)}
            aria-label="Menos 15 segundos de descanso"
            className="flex size-9 items-center justify-center rounded-md text-[0.75rem] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            −15
          </button>
          <button
            type="button"
            onClick={() => ajustar(PASSO_S)}
            aria-label="Mais 15 segundos de descanso"
            className="flex size-9 items-center justify-center rounded-md text-[0.75rem] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            +15
          </button>
          <button
            type="button"
            onClick={alternar}
            aria-label={rodando ? "Pausar descanso" : "Iniciar descanso"}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            {rodando ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => reiniciar(alvo)}
            aria-label="Reiniciar descanso"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const novo = !som;
              setSom(novo);
              try {
                localStorage.setItem(CHAVE_SOM, novo ? "1" : "0");
              } catch {
                /* a preferência não persiste, mas vale para esta sessão. */
              }
            }}
            aria-label={som ? "Silenciar o aviso de fim do descanso" : "Avisar quando o descanso acabar"}
            aria-pressed={som}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            {som ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
