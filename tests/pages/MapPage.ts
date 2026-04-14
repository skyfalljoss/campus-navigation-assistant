import { expect, type Locator, type Page } from "@playwright/test";

export class MapPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly guideButton: Locator;
  readonly guideHeading: Locator;
  readonly closeGuideButton: Locator;
  readonly noResultsMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder("Search buildings, rooms, services...");
    this.guideButton = page.getByRole("button", { name: "Guide" });
    this.guideHeading = page.getByRole("heading", { name: "How to use the campus map" });
    this.closeGuideButton = page.getByRole("button", { name: "Close map guide" });
    this.noResultsMessage = page.getByText("No locations found.");
  }

  async goto() {
    await this.page.goto("/map");
    await expect(this.searchInput).toBeVisible();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  async selectBuilding(name: string) {
    await this.page.getByRole("button", { name }).click();
  }

  async selectRoom(name: string) {
    await this.page.getByRole("button", { name: new RegExp(name, "i") }).click();
  }
}
