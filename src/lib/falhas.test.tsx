import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache, useMutation } from "@tanstack/react-query";
import { AvisosDeFalha } from "@/components/avisos-de-falha";
import { registrarFalha, limparFalhas, descartarFalha, __resetFalhas } from "./falhas";

beforeEach(() => __resetFalhas());
afterEach(() => limparFalhas());

/** Reproduz a fiação real: MutationCache → registrarFalha → <AvisosDeFalha>. */
function comMutationQueFalha(erro: Error, meta?: Record<string, unknown>) {
  const qc = new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache({
      onError: (e, _v, _c, mutation) => {
        if (mutation.meta?.tratadoNaTela === true) return;
        registrarFalha(e);
      },
    }),
    defaultOptions: { mutations: { retry: false } },
  });

  function Botao() {
    const m = useMutation({
      meta,
      mutationFn: async () => {
        throw erro;
      },
    });
    return (
      <button type="button" onClick={() => m.mutate()}>
        salvar
      </button>
    );
  }

  return render(
    <QueryClientProvider client={qc}>
      <AvisosDeFalha />
      <Botao />
    </QueryClientProvider>,
  );
}

describe("uma escrita que falha não pode falhar calada", () => {
  it("mostra ao usuário o que aconteceu e o que fazer", async () => {
    // Este é o caso que quebrou de verdade: importar contra um banco que nunca
    // recebeu a migração. Antes, o botão voltava ao normal e nada mais.
    comMutationQueFalha(new Error("SQLITE_ERROR: no such table: diet_plans"));

    await userEvent.click(screen.getByRole("button", { name: "salvar" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/desatualizado/i);
    expect(alerta).toHaveTextContent("diet_plans");
    expect(alerta).toHaveTextContent(/db:setup/);
  });

  it("guarda a mensagem original atrás de 'detalhe técnico'", async () => {
    comMutationQueFalha(new Error("SQLITE_ERROR: no such table: diet_plans"));
    await userEvent.click(screen.getByRole("button", { name: "salvar" }));
    await screen.findByRole("alert");

    // Fica fora do caminho de quem só quer usar o app, e à mão de quem precisa
    // descobrir a causa.
    expect(screen.queryByText(/SQLITE_ERROR/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /detalhe técnico/i }));
    expect(screen.getByText(/SQLITE_ERROR: no such table: diet_plans/)).toBeInTheDocument();
  });

  it("dá para dispensar o aviso", async () => {
    comMutationQueFalha(new Error("falha qualquer"));
    await userEvent.click(screen.getByRole("button", { name: "salvar" }));
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: /dispensar/i }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("insistir no botão não empilha o mesmo aviso", async () => {
    comMutationQueFalha(new Error("mesma falha"));
    const botao = screen.getByRole("button", { name: "salvar" });
    await userEvent.click(botao);
    await screen.findByRole("alert");
    await userEvent.click(botao);
    await userEvent.click(botao);

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
  });

  it("cala o banner quando a própria tela mostra a falha", async () => {
    // Sem isso o usuário lê a mesma frase duas vezes: no topo e ao lado do botão.
    comMutationQueFalha(new Error("no such table: diet_plans"), { tratadoNaTela: true });
    await userEvent.click(screen.getByRole("button", { name: "salvar" }));

    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("fila de falhas", () => {
  it("não renderiza nada quando está vazia", () => {
    render(<AvisosDeFalha />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mostra falhas diferentes lado a lado", async () => {
    render(<AvisosDeFalha />);
    registrarFalha(new Error("no such table: diet_plans"));
    registrarFalha(new Error("Failed to fetch"));
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
  });

  it("descartarFalha remove só a indicada", async () => {
    render(<AvisosDeFalha />);
    registrarFalha(new Error("primeira"));
    registrarFalha(new Error("segunda"));
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));

    descartarFalha(1);
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
  });
});

describe("erro de autenticação não vira banner", () => {
  it("desloga em vez de mostrar aviso genérico", async () => {
    // Um 401 significa "entre de novo", não "algo deu errado ao salvar".
    const onUnauthorized = vi.fn();
    const qc = new QueryClient({
      mutationCache: new MutationCache({
        onError: (e) => {
          if (e instanceof Error && /401/.test(e.message)) {
            onUnauthorized();
            return;
          }
          registrarFalha(e);
        },
      }),
      defaultOptions: { mutations: { retry: false } },
    });

    function Botao() {
      const m = useMutation({
        mutationFn: async () => {
          throw new Error("login 401");
        },
      });
      return (
        <button type="button" onClick={() => m.mutate()}>
          salvar
        </button>
      );
    }

    render(
      <QueryClientProvider client={qc}>
        <AvisosDeFalha />
        <Botao />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "salvar" }));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
