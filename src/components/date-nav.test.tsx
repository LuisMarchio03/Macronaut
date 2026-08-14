import { it, expect, describe, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider } from "../lib/data-context";
import { hoje } from "../lib/date";
import { DateNav } from "./date-nav";

afterEach(() => vi.useRealTimers());

const renderNav = (dataInicial?: string) =>
  render(
    <DataProvider dataInicial={dataInicial}>
      <DateNav />
    </DataProvider>,
  );

const campoData = () => screen.getByLabelText(/escolher data/i);

it("em hoje: sem botão Hoje, avançar desabilitado, input max=hoje", () => {
  renderNav();
  expect(screen.queryByRole("button", { name: /^hoje$/i })).toBeNull();
  expect(screen.getByRole("button", { name: /próximo dia/i })).toBeDisabled();
  expect(campoData()).toHaveAttribute("max", hoje());
});

it("em dia passado: mostra o botão Hoje, que volta ao dia atual", async () => {
  renderNav("2026-07-01");
  const btnHoje = screen.getByRole("button", { name: /^hoje$/i });
  await userEvent.click(btnHoje);
  expect(campoData()).toHaveValue(hoje());
});

it("dia anterior anda para trás", async () => {
  renderNav("2026-07-07");
  await userEvent.click(screen.getByRole("button", { name: /dia anterior/i }));
  expect(campoData()).toHaveValue("2026-07-06");
});

describe("rótulo do dia", () => {
  it("diz em texto qual dia está sendo visto, não só pela cor da borda", () => {
    // Sinalizar "dia retroativo" apenas mudando a cor da borda deixa a
    // informação inacessível a quem não distingue as duas cores.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 7, 10, 0));
    renderNav("2026-07-05");
    expect(screen.getByText("Domingo, 5 de julho")).toBeInTheDocument();
  });

  it("usa 'Hoje' quando é o dia atual", () => {
    renderNav();
    expect(screen.getByText("Hoje")).toBeInTheDocument();
  });
});
