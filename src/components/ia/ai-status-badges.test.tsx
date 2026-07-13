import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiStatusBadges } from "./ai-status-badges";

it("reflete up/down por provedor", () => {
  render(
    <AiStatusBadges
      health={{ gemini: { up: true }, aloy: { up: false } }}
      enabled={{ gemini: true, aloy: true }}
    />,
  );
  expect(screen.getByTestId("status-gemini")).toHaveAttribute("data-up", "true");
  expect(screen.getByTestId("status-aloy")).toHaveAttribute("data-up", "false");
});

it("gateway inalcançável: acusa o gateway em vez de culpar os provedores", () => {
  render(
    <AiStatusBadges health={undefined} enabled={{ gemini: true, aloy: true }} gatewayOffline />,
  );
  expect(screen.getByTestId("status-gateway")).toBeInTheDocument();
  // sem resposta do gateway não sabemos nada dos provedores; marcá-los como
  // "offline" foi justamente o que escondeu a URL do gateway errada no deploy.
  expect(screen.queryByTestId("status-gemini")).toBeNull();
  expect(screen.queryByTestId("status-aloy")).toBeNull();
});

it("health ainda carregando: provedores ficam em desconhecido, não em offline", () => {
  render(<AiStatusBadges health={undefined} enabled={{ gemini: true, aloy: true }} />);
  expect(screen.getByTestId("status-gemini")).toHaveAttribute("data-state", "desconhecido");
  expect(screen.getByTestId("status-aloy")).toHaveAttribute("data-state", "desconhecido");
});

it("expõe o detalhe da ALOY quando ela está fora", () => {
  render(
    <AiStatusBadges
      health={{ gemini: { up: true }, aloy: { up: false, detail: "sem conexão" } }}
      enabled={{ gemini: true, aloy: true }}
    />,
  );
  expect(screen.getByTestId("status-aloy")).toHaveAttribute("title", "sem conexão");
});

it("não renderiza o badge ALOY quando aloy está desabilitado", () => {
  render(
    <AiStatusBadges
      health={{ gemini: { up: true }, aloy: { up: true } }}
      enabled={{ gemini: true, aloy: false }}
    />,
  );
  expect(screen.getByTestId("status-gemini")).toBeInTheDocument();
  expect(screen.queryByTestId("status-aloy")).toBeNull();
});

it("renderiza os dois badges quando ambos os provedores estão habilitados", () => {
  render(
    <AiStatusBadges
      health={{ gemini: { up: true }, aloy: { up: true } }}
      enabled={{ gemini: true, aloy: true }}
    />,
  );
  expect(screen.getByTestId("status-gemini")).toBeInTheDocument();
  expect(screen.getByTestId("status-aloy")).toBeInTheDocument();
});
