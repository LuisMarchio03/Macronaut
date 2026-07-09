import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderSelector } from "./provider-selector";

it("mostra só provedores habilitados", () => {
  render(
    <ProviderSelector
      enabled={{ gemini: true, aloy: false }}
      value="gemini"
      onChange={vi.fn()}
      health={{ gemini: { up: true }, aloy: { up: false } }}
    />,
  );
  expect(screen.getByRole("button", { name: /gemini/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /aloy/i })).not.toBeInTheDocument();
});
