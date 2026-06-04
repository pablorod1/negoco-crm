import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    setupFiles: ["./test/setup-vitest.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
