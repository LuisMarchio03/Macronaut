import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("PWA manifest", () => {
  it("manifest declara nome e display standalone", () => {
    const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf-8"));
    expect(m.name).toBe("Macronaut");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#0a0c12");
  });
});
