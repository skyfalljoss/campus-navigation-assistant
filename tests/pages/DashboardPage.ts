import { expect, type Locator, type Page } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly heroHeading: Locator;
  readonly routeSearchInput: Locator;
  readonly findRouteButton: Locator;
  readonly shuttleHeading: Locator;
  readonly moreShuttleInfoLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroHeading = page.getByRole("heading", { name: /Where are you headed today\?/i });
    this.routeSearchInput = page.getByPlaceholder("Enter building name, room number, or event...");
    this.findRouteButton = page.getByRole("button", { name: "Find Route" });
    this.shuttleHeading = page.getByRole("heading", { name: "Live Shuttle" });
    this.moreShuttleInfoLink = page.getByRole("link", { name: /More Shuttle Info/i });
  }

  async goto() {
    await this.page.goto("/");
    await expect(this.heroHeading).toBeVisible();
  }

  async search(query: string) {
    await this.routeSearchInput.fill(query);
    await this.findRouteButton.click();
  }
}
