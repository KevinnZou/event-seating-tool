import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/pages",
  testMatch: "pages.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4175/event-seating-tool/",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command:
      "npm run preview -- --host 127.0.0.1 --port 4175 --base /event-seating-tool/",
    url: "http://127.0.0.1:4175/event-seating-tool/",
    reuseExistingServer: false,
  },
});
