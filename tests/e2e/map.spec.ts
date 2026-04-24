import { expect, test } from "@playwright/test";

import { blockExternalMapTiles } from "../fixtures/network";
import { MapPage } from "../pages/MapPage";

test.describe("map", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalMapTiles(page);
  });

  test("searches for a building and drills into a room", async ({ page }) => {
    const mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.search("ENB");
    await mapPage.selectBuilding("Engineering Building II (ENB)");

    await expect(page.getByRole("heading", { name: "Engineering Building II (ENB)" })).toBeVisible();
    await expect(page.getByText("Key Locations")).toBeVisible();

    await mapPage.selectRoom("ENB 118");

    await expect(page.getByText("Large lecture hall")).toBeVisible();
    await expect(page.getByRole("button", { name: "View all building locations" })).toBeVisible();
  });

  test("shows the map guide and empty-state search results", async ({ page }) => {
    const mapPage = new MapPage(page);
    await mapPage.goto();

    await mapPage.guideButton.click();
    await expect(mapPage.guideHeading).toBeVisible();
    await mapPage.closeGuideButton.click();
    await expect(mapPage.guideHeading).toBeHidden();

    await mapPage.search("xyznonexistent123");
    await expect(mapPage.noResultsMessage).toBeVisible();
  });

  test("focuses the search field when clicking the visible search pill", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const mapPage = new MapPage(page);
    await mapPage.goto();
    const searchShell = page.getByTestId("map-search-shell");

    await expect(searchShell).toBeVisible();

    const box = await searchShell.boundingBox();
    if (!box) {
      throw new Error("Search shell is not measurable.");
    }

    const clickPositions = [
      { x: 20, y: 8 },
      { x: Math.round(box.width / 2), y: Math.round(box.height / 2) },
      { x: Math.max(20, Math.round(box.width - 20)), y: Math.max(8, Math.round(box.height - 8)) },
    ];

    for (const position of clickPositions) {
      await page.evaluate(() => {
        const activeElement = document.activeElement as HTMLElement | null;
        activeElement?.blur();
      });

      await searchShell.click({ position });
      await expect(mapPage.searchInput).toBeFocused();
    }
  });
});
