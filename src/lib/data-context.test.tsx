import { it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { DataProvider, useDataAtiva } from "./data-context";
import { hoje } from "./date";

const wrapper = (dataInicial?: string) =>
  function W({ children }: { children: ReactNode }) {
    return <DataProvider dataInicial={dataInicial}>{children}</DataProvider>;
  };

it("default é hoje e ehHoje=true", () => {
  const { result } = renderHook(() => useDataAtiva(), { wrapper: wrapper() });
  expect(result.current.data).toBe(hoje());
  expect(result.current.ehHoje).toBe(true);
});

it("setData no futuro é limitado a hoje", () => {
  const { result } = renderHook(() => useDataAtiva(), { wrapper: wrapper() });
  act(() => result.current.setData("2999-01-01"));
  expect(result.current.data).toBe(hoje());
});

it("passoDia(-1) volta um dia; passoDia(+1) não passa de hoje", () => {
  const { result } = renderHook(() => useDataAtiva(), { wrapper: wrapper("2026-07-07") });
  act(() => result.current.passoDia(-1));
  expect(result.current.data).toBe("2026-07-06");
  const { result: r2 } = renderHook(() => useDataAtiva(), { wrapper: wrapper() });
  act(() => r2.current.passoDia(1)); // já em hoje
  expect(r2.current.data).toBe(hoje());
});

it("irHoje volta ao dia atual", () => {
  const { result } = renderHook(() => useDataAtiva(), { wrapper: wrapper("2026-07-01") });
  expect(result.current.ehHoje).toBe(false);
  act(() => result.current.irHoje());
  expect(result.current.data).toBe(hoje());
  expect(result.current.ehHoje).toBe(true);
});

it("passoDia(-1) cruza fronteira de mês", () => {
  const { result } = renderHook(() => useDataAtiva(), { wrapper: wrapper("2026-03-01") });
  act(() => result.current.passoDia(-1));
  expect(result.current.data).toBe("2026-02-28");
});

it("passoDia(-1) cruza fronteira de ano", () => {
  const { result } = renderHook(() => useDataAtiva(), { wrapper: wrapper("2026-01-01") });
  act(() => result.current.passoDia(-1));
  expect(result.current.data).toBe("2025-12-31");
});

it("dataInicial no futuro é fixada em hoje", () => {
  const { result } = renderHook(() => useDataAtiva(), { wrapper: wrapper("2999-01-01") });
  expect(result.current.data).toBe(hoje());
  expect(result.current.ehHoje).toBe(true);
});
