import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
export default defineConfig(({ mode }) => ({
  base: "./",
  server: { hmr: mode === "e2e" ? false : undefined },
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
