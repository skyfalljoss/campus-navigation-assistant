import { expect, test } from "@playwright/test";

import { blockExternalMapTiles, mockShuttleOverview } from "../fixtures/network";
import { DashboardPage } from "../pages/DashboardPage";

test.describe("dashboard", () => {
  test("shows a mocked live shuttle summary", async ({ page }) => {
    await mockShuttleOverview(page);

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await expect(dashboardPage.shuttleHeading).toBeVisible();
    await expect(page.getByText("3 Active Buses")).toBeVisible();
    await expect(page.getByText("Minor service delay on Orange Line")).toBeVisible();
    await expect(page.getByText("Orange Line", { exact: true })).toBeVisible();
    await expect(dashboardPage.moreShuttleInfoLink).toBeVisible();
  });

  test("passes dashboard search into the map page", async ({ page }) => {
    await mockShuttleOverview(page);
    await blockExternalMapTiles(page);

    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.search("library");

    await expect(page).toHaveURL(/\/map\?q=library/i);
  });
});
