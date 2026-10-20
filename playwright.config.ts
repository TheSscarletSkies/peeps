import { defineConfig } from "@playwright/test";

/** End-to-end checks of the interface against the built-in demo data, one per use case in docs/use-cases.md. */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1280, height: 860 },
    contextOptions: { screen: { width: 1280, height: 860 } },
  },
  webServer: {
    command: "npx vite --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
