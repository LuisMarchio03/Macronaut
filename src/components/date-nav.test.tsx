import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider } from "../lib/data-context";
import { hoje } from "../lib/date";
import { DateNav } from "./date-nav";

const renderNav = (dataInicial?: string) =>
  render(
    <DataProvider dataInicial={dataInicial}>
      <DateNav />
    </DataProvider>,
  );

it("em hoje: sem botão Hoje, avançar desabilitado, input max=hoje", () => {
  renderNav();
  expect(screen.queryByRole("button", { name: /^hoje$/i })).toBeNull();
  expect(screen.getByRole("button", { name: /próximo dia/i })).toBeDisabled();
  expect(screen.getByLabelText(/data/i)).toHaveAttribute("max", hoje());
});

it("em dia passado: mostra Hoje e RETROATIVO; Hoje volta ao atual", async () => {
  renderNav("2026-07-01");
  expect(screen.getByText(/retroativo/i)).toBeInTheDocument();
  const btnHoje = screen.getByRole("button", { name: /^hoje$/i });
  await userEvent.click(btnHoje);
  expect(screen.getByLabelText(/data/i)).toHaveValue(hoje());
});

it("dia anterior anda para trás", async () => {
  renderNav("2026-07-07");
  await userEvent.click(screen.getByRole("button", { name: /dia anterior/i }));
  expect(screen.getByLabelText(/data/i)).toHaveValue("2026-07-06");
});
