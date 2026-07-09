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
