import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { apiDev } from "./vite-plugin-api-dev";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Sem isto, `npm run dev` abre numa tela de login que não funciona — e,
    // desde que o banco vive atrás de `/api/db`, num app que não carrega nada.
    apiDev(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // usamos public/manifest.webmanifest
      workbox: { navigateFallback: "/index.html" },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
