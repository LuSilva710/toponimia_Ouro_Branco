import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  testDir: "./src/executors",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          "../../reports/playwright-results.json",
      },
    ],
  ],
  use: {
    baseURL: process.env.TARGET_BROWSER_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "../../reports/playwright-artifacts",
});
