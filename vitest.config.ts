import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    // Um teste de componente aqui inclui montar um banco libSQL em memória e
    // aplicar o schema antes da primeira consulta resolver. Com os 5s padrão,
    // a suíte cheia (que compete por CPU entre arquivos) derrubava testes
    // corretos por tempo, não por defeito. Ver `test/setup.ts`.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
