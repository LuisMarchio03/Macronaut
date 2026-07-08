import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeletorPeriodo } from "./seletor-periodo";

const periodoSemana = { inicio: "2026-07-06", fim: "2026-07-12" };

it("mostra o rótulo do período atual", () => {
  render(<SeletorPeriodo gran="semana" periodo={periodoSemana} onChange={() => {}} />);
  expect(screen.getByText("6–12 jul 2026")).toBeInTheDocument();
});

it("‹ navega para o período anterior", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SeletorPeriodo gran="semana" periodo={periodoSemana} onChange={onChange} />);
  await user.click(screen.getByLabelText("período anterior"));
  expect(onChange).toHaveBeenCalledWith("semana", { inicio: "2026-06-29", fim: "2026-07-05" });
});

it("trocar para Mês re-ancora no início do período atual", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SeletorPeriodo gran="semana" periodo={periodoSemana} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: "Mês" }));
  expect(onChange).toHaveBeenCalledWith("mes", { inicio: "2026-07-01", fim: "2026-07-31" });
});

it("no personalizado, se início > fim, troca os dois", () => {
  const onChange = vi.fn();
  render(<SeletorPeriodo gran="personalizado" periodo={{ inicio: "2026-07-10", fim: "2026-07-20" }} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("data inicial"), { target: { value: "2026-07-25" } });
  expect(onChange).toHaveBeenCalledWith("personalizado", { inicio: "2026-07-20", fim: "2026-07-25" });
});

it("trocar para Personalizado preserva o período atual (não colapsa)", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SeletorPeriodo gran="semana" periodo={periodoSemana} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: "Personalizado" }));
  expect(onChange).toHaveBeenCalledWith("personalizado", periodoSemana);
});
