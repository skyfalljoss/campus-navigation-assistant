import { expect, test } from "@playwright/test";

import { EMAIL_UPDATES_STORAGE_KEY, THEME_STORAGE_KEY } from "../../src/lib/preferences";
import { SettingsPage } from "../pages/SettingsPage";

test.describe("settings", () => {
  test("stores theme and email preferences in local storage", async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    await settingsPage.darkThemeButton.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY)).toBe("dark");

    await expect(settingsPage.emailUpdatesSwitch).toHaveAttribute("aria-checked", "true");
    await settingsPage.emailUpdatesSwitch.click();
    await expect(settingsPage.emailUpdatesSwitch).toHaveAttribute("aria-checked", "false");
    expect(await page.evaluate((key) => window.localStorage.getItem(key), EMAIL_UPDATES_STORAGE_KEY)).toBe("false");
  });
});
