import { expect, test } from "@playwright/test";

import { enableSignedInSession, mockAuthenticatedCampusApi } from "../fixtures/authenticated";
import { blockExternalMapTiles } from "../fixtures/network";
import { MapPage } from "../pages/MapPage";

test.describe("authenticated account flows", () => {
  test("saves a location from the map and shows it on the saved page", async ({ page }) => {
    await enableSignedInSession(page);
    await mockAuthenticatedCampusApi(page, { savedBuildingIds: [] });
    await blockExternalMapTiles(page);

    const mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.search("Library");
    await mapPage.selectBuilding("USF Library (LIB)");

    await expect(page.getByRole("button", { name: "Save location" })).toBeVisible();
    await page.getByRole("button", { name: "Save location" }).click();
    await expect(page.getByRole("button", { name: "Remove saved location" })).toBeVisible();

    await page.goto("/saved");
    await expect(page.getByText("USF Library (LIB)", { exact: true })).toBeVisible();
  });

  test("shows saved places and recent activity on the profile page", async ({ page }) => {
    await enableSignedInSession(page);
    await mockAuthenticatedCampusApi(page, {
      savedBuildingIds: ["lib"],
      recentLocations: [
        {
          query: "ENB 118",
          buildingId: "enb",
          roomId: "enb-118",
        },
      ],
    });

    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Bulls Tester" })).toBeVisible();
    await expect(page.getByText("bulls@example.com").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Manage Account/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign Out/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Saved Places" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent Searches" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Primary Email" })).toBeVisible();
  });
});
