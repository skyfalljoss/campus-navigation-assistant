import { expect, type Locator, type Page } from "@playwright/test";

export class SettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly darkThemeButton: Locator;
  readonly lightThemeButton: Locator;
  readonly systemThemeButton: Locator;
  readonly emailUpdatesSwitch: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Settings" });
    this.darkThemeButton = page.getByRole("button", { name: /^Dark$/ });
    this.lightThemeButton = page.getByRole("button", { name: /^Light$/ });
    this.systemThemeButton = page.getByRole("button", { name: /^System$/ });
    this.emailUpdatesSwitch = page.getByRole("switch", { name: "Email Updates" });
  }

  async goto() {
    await this.page.goto("/settings");
    await expect(this.heading).toBeVisible();
  }
}
