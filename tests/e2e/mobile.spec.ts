import { expect, test } from "@playwright/test";

import { blockExternalMapTiles, mockShuttleOverview } from "../fixtures/network";

test.describe("mobile navigation @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalMapTiles(page);
    await mockShuttleOverview(page);
  });

  test("opens the map from the mobile header search shortcut", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Open map search" }).click();

    await expect(page).toHaveURL(/\/map$/);
    await expect(page.getByPlaceholder("Search buildings, rooms, services...")).toBeVisible();
  });

  test("uses the mobile bottom nav to move between map and saved", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Search/i }).click();
    await expect(page).toHaveURL(/\/map$/);
    await expect(page.getByPlaceholder("Search buildings, rooms, services...")).toBeVisible();

    await page.getByRole("link", { name: /Saved/i }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect(page.getByRole("heading", { name: "Sign in to view saved places" })).toBeVisible();
  });
});
