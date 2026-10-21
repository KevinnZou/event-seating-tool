import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "live-release.spec.ts",
  outputDir: "test-results/live",
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: "https://kevinnzou.github.io/event-seating-tool/",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "live-chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        },
        viewport: { width: 1504, height: 1046 },
      },
    },
    { name: "live-webkit", use: { ...devices["Desktop Safari"] } },
    { name: "live-ios-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
