import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  outputDir: "test-results",
  reporter: process.env.CI
    ? [
        ["html", { outputFolder: "playwright-report", open: "never" }],
        ["junit", { outputFile: "playwright-results.xml" }],
      ]
    : [
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 30000,
    permissions: ["geolocation"],
    geolocation: {
      latitude: 28.06082,
      longitude: -82.41332,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      grepInvert: /@mobile/,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      grepInvert: /@mobile/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      grepInvert: /@mobile/,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: "npm run dev:client:e2e",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
