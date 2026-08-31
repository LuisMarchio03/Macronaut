import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CronometroDescanso } from "./cronometro-descanso";

/** O relógio de parede do teste, que anda quando eu mandar. */
let relogio = 1_000_000;
const agora = () => relogio;

/** Anda `s` segundos de relógio E de temporizador, como o navegador faria. */
async function passar(s: number) {
  relogio += s * 1000;
  await act(async () => {
    vi.advanceTimersByTime(s * 1000);
  });
}

const mostrador = () => screen.getByLabelText(/^descanso:/i).textContent;

beforeEach(() => {
  relogio = 1_000_000;
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const montar = (props: Partial<Parameters<typeof CronometroDescanso>[0]> = {}) =>
  render(<CronometroDescanso chave={0} segundos={90} sessionId={1} agora={agora} {...props} />);

describe("estado ocioso", () => {
  it("aparece na tela antes da primeira série, parado no descanso do exercício", async () => {
    // Antes ele nem existia até a primeira série entrar — não havia como
    // cronometrar um aquecimento.
    montar();
    expect(mostrador()).toBe("1:30");
    await passar(5);
    expect(mostrador()).toBe("1:30");
  });

  it("dá para iniciar na mão", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Iniciar descanso" }));
    await passar(10);
    expect(mostrador()).toBe("1:20");
  });

  it("ocioso, acompanha o descanso do exercício da vez", () => {
    const { rerender } = montar();
    rerender(<CronometroDescanso chave={0} segundos={60} sessionId={1} agora={agora} />);
    expect(mostrador()).toBe("1:00");
  });
});

describe("a série registrada dispara o descanso", () => {
  it("o PRIMEIRO descanso começa a correr sozinho", async () => {
    // O bug: a guarda era um `useRef` que pulava o primeiro efeito, e o
    // componente só montava depois da 1ª série — então era exatamente o
    // primeiro descanso que nascia congelado. Em dev o StrictMode rodava o
    // efeito duas vezes e escondia isso; em produção, não.
    const { rerender } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);

    await passar(4);
    expect(mostrador()).toBe("1:26");
  });

  it("cada série seguinte reinicia a contagem", async () => {
    const { rerender } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(30);
    expect(mostrador()).toBe("1:00");

    rerender(<CronometroDescanso chave={2} segundos={90} sessionId={1} agora={agora} />);
    await passar(1);
    expect(mostrador()).toBe("1:29");
  });

  it("passa do zero contando para cima, em vez de congelar", async () => {
    const { rerender } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(100);
    expect(mostrador()).toBe("+0:10");
  });
});

describe("pausar, reiniciar e ajustar", () => {
  it("pausa e retoma de onde parou", async () => {
    const { rerender } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(20);

    await userEvent.click(screen.getByRole("button", { name: "Pausar descanso" }));
    await passar(30);
    expect(mostrador()).toBe("1:10");

    await userEvent.click(screen.getByRole("button", { name: "Iniciar descanso" }));
    await passar(10);
    expect(mostrador()).toBe("1:00");
  });

  it("reinicia no alvo", async () => {
    const { rerender } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(60);

    await userEvent.click(screen.getByRole("button", { name: "Reiniciar descanso" }));
    expect(mostrador()).toBe("1:30");
  });

  it("+15 e −15 mexem no descanso em curso", async () => {
    const { rerender } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(10);
    expect(mostrador()).toBe("1:20");

    await userEvent.click(screen.getByRole("button", { name: /mais 15 segundos/i }));
    expect(mostrador()).toBe("1:35");

    await userEvent.click(screen.getByRole("button", { name: /menos 15 segundos/i }));
    expect(mostrador()).toBe("1:20");
  });

  it("o alvo ajustado vale para o descanso seguinte", async () => {
    const { rerender } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await userEvent.click(screen.getByRole("button", { name: /mais 15 segundos/i }));

    await userEvent.click(screen.getByRole("button", { name: "Reiniciar descanso" }));
    expect(mostrador()).toBe("1:45");
  });

  it("não deixa o alvo chegar a zero", async () => {
    montar({ segundos: 15 });
    await userEvent.click(screen.getByRole("button", { name: /menos 15 segundos/i }));
    expect(mostrador()).toBe("0:15");
  });
});

describe("sobrevive a fechar o app", () => {
  it("volta contando pelo relógio de parede, não de onde parou", async () => {
    // Um `setInterval` não roda em segundo plano: voltar depois de três
    // minutos mostrava o mesmo número de quando você saiu.
    const { rerender, unmount } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(10);
    expect(mostrador()).toBe("1:20");
    unmount();

    relogio += 180_000; // três minutos com o app fechado
    montar();
    expect(mostrador()).toBe("+1:40");
  });

  it("pausado, volta pausado e no mesmo número", async () => {
    const { rerender, unmount } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(20);
    await userEvent.click(screen.getByRole("button", { name: "Pausar descanso" }));
    unmount();

    relogio += 600_000;
    montar();
    expect(mostrador()).toBe("1:10");
    expect(screen.getByRole("button", { name: "Iniciar descanso" })).toBeInTheDocument();
  });

  it("o descanso é da sessão: outra sessão não herda o relógio", async () => {
    const { rerender, unmount } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(60);
    unmount();

    render(<CronometroDescanso chave={0} segundos={120} sessionId={2} agora={agora} />);
    expect(mostrador()).toBe("2:00");
  });

  it("armazenamento corrompido não derruba a tela", () => {
    localStorage.setItem("macronaut.descanso", "{ isto não é json");
    montar();
    expect(mostrador()).toBe("1:30");
  });
});

describe("aviso de fim", () => {
  it("vibra uma única vez ao cruzar o zero", async () => {
    const vibrar = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrar, configurable: true });

    const { rerender } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(89);
    expect(vibrar).not.toHaveBeenCalled();

    await passar(2);
    expect(vibrar).toHaveBeenCalledTimes(1);

    // Continua contando para cima; o aviso não se repete a cada tick.
    await passar(10);
    expect(vibrar).toHaveBeenCalledTimes(1);
  });

  it("silenciado, não avisa", async () => {
    const vibrar = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrar, configurable: true });

    const { rerender } = montar();
    await userEvent.click(screen.getByRole("button", { name: /silenciar/i }));
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(95);

    expect(vibrar).not.toHaveBeenCalled();
  });

  it("a preferência de som sobrevive a fechar a tela", async () => {
    const { unmount } = montar();
    await userEvent.click(screen.getByRole("button", { name: /silenciar/i }));
    unmount();

    montar();
    expect(screen.getByRole("button", { name: /avisar quando o descanso acabar/i })).toBeInTheDocument();
  });

  it("o descanso seguinte volta a poder avisar", async () => {
    const vibrar = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrar, configurable: true });

    const { rerender } = montar();
    rerender(<CronometroDescanso chave={1} segundos={90} sessionId={1} agora={agora} />);
    await passar(95);
    expect(vibrar).toHaveBeenCalledTimes(1);

    rerender(<CronometroDescanso chave={2} segundos={90} sessionId={1} agora={agora} />);
    await passar(95);
    expect(vibrar).toHaveBeenCalledTimes(2);
  });
});
