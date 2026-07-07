import { it, expect } from "vitest";
import { hoje, formatarData } from "./date";

it("hoje devolve YYYY-MM-DD", () => {
  expect(hoje()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
it("formata data local", () => {
  expect(formatarData("2026-07-06")).toBe("06/07/2026");
});
