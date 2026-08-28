import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TreinoLayout } from "./treino-layout";

/**
 * O treino era cinco rotas e uma biblioteca exilada em "Mais": para saber o
 * que treinar amanhã você saía da tela, e para ver a carga de um exercício
 * saía de novo, por outro caminho. Agora é uma tela com quatro abas.
 *
 * As abas são LINKS, não estado local: a rota continua sendo o endereço da
 * seção, então o voltar do celular funciona, um link para "/treino/rotina"
 * abre na aba certa e a barra inferior sabe que você está no treino.
 */
function montar(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/treino" element={<TreinoLayout />}>
          <Route index element={<p>painel hoje</p>} />
          <Route path="rotina" element={<p>painel rotina</p>} />
          <Route path="progresso" element={<p>painel progresso</p>} />
          <Route path="exercicios" element={<p>painel exercícios</p>} />
          <Route path="sessao/:id" element={<p>painel detalhe</p>} />
          <Route path="calistenia" element={<p>painel calistenia</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Treino — abas", () => {
  it("as quatro seções são abas de uma tela só", () => {
    montar("/treino");
    const nav = screen.getByRole("navigation", { name: /seções do treino/i });
    const destinos = [
      [/^hoje$/i, "/treino"],
      [/^rotina$/i, "/treino/rotina"],
      [/^progresso$/i, "/treino/progresso"],
      [/^exercícios$/i, "/treino/exercicios"],
    ] as const;
    for (const [nome, href] of destinos) {
      expect(screen.getByRole("link", { name: nome })).toHaveAttribute("href", href);
    }
    expect(nav).toBeInTheDocument();
  });

  it("a aba da rota atual é a única marcada", () => {
    montar("/treino/rotina");
    expect(screen.getByRole("link", { name: /^rotina$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const outra of [/^hoje$/i, /^progresso$/i, /^exercícios$/i]) {
      expect(screen.getByRole("link", { name: outra })).not.toHaveAttribute("aria-current");
    }
  });

  /** Sem `end`, "/treino" seria prefixo de todas e acenderia em toda aba. */
  it("a aba Hoje só acende na raiz do treino", () => {
    montar("/treino/progresso");
    expect(screen.getByRole("link", { name: /^hoje$/i })).not.toHaveAttribute("aria-current");
  });

  /**
   * O detalhe de uma sessão não é uma quinta aba — é o conteúdo da terceira.
   * Sem o alias, abrir uma sessão apagava as quatro e a tela dizia "você não
   * está em lugar nenhum".
   */
  it("o detalhe de uma sessão mantém Progresso aceso", () => {
    montar("/treino/sessao/7");
    expect(screen.getByText("painel detalhe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^progresso$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("o painel da rota é o que aparece abaixo das abas", () => {
    montar("/treino/exercicios");
    expect(screen.getByText("painel exercícios")).toBeInTheDocument();
    expect(screen.queryByText("painel hoje")).not.toBeInTheDocument();
  });

  /**
   * A calistenia nasceu do card que vive em "Hoje" — é o aprofundamento dele,
   * não uma quinta aba. Sem o alias, abrir a tela apagava as quatro e a tela
   * dizia "você não está em lugar nenhum", o mesmo defeito do detalhe de sessão.
   */
  it("a calistenia mantém Hoje aceso", () => {
    montar("/treino/calistenia");
    expect(screen.getByText("painel calistenia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^hoje$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
