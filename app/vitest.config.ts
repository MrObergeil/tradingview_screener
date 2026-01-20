import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environmentMatchGlobs: [
      // Client tests use jsdom
      ["tests/client/**", "jsdom"],
      // Server tests use node
      ["tests/**", "node"],
    ],
  },
});
