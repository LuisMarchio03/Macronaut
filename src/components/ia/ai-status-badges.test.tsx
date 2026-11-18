import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiStatusBadges } from "./ai-status-badges";

it("reflete up/down do Gemini", () => {
  const { rerender } = render(
    <AiStatusBadges health={{ gemini: { up: true } }} enabled={{ gemini: true }} />,
  );
  expect(screen.getByTestId("status-gemini")).toHaveAttribute("data-up", "true");
  rerender(<AiStatusBadges health={{ gemini: { up: false } }} enabled={{ gemini: true }} />);
  expect(screen.getByTestId("status-gemini")).toHaveAttribute("data-up", "false");
});

it("não renderiza o badge quando o Gemini está desabilitado", () => {
  render(<AiStatusBadges health={{ gemini: { up: true } }} enabled={{ gemini: false }} />);
  expect(screen.queryByTestId("status-gemini")).toBeNull();
});
