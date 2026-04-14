import { expect, test } from "@playwright/test";

import { enableSignedInSession, mockAuthenticatedCampusApi } from "../fixtures/authenticated";
import { mockShuttleOverview } from "../fixtures/network";

test.describe("authenticated schedule flows", () => {
  test("creates, updates, and deletes a schedule entry", async ({ page }) => {
    await enableSignedInSession(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("usf_dashboard_schedule_collapsed", "false");
    });
    await mockAuthenticatedCampusApi(page, {
      savedBuildingIds: [],
      recentLocations: [],
      scheduleEntries: [],
    });
    await mockShuttleOverview(page);

    await page.goto("/");

    await page.getByRole("button", { name: /^Add Class$/ }).click();
    await expect(page.getByRole("heading", { name: "Add Class" })).toBeVisible();

    const modalForm = page.locator("form").filter({ has: page.getByPlaceholder("COP 3514 Data Structures") });
    await page.getByPlaceholder("COP 3514 Data Structures").fill("COP 3514 Data Structures");
    await page.getByPlaceholder("ENB 118").fill("ENB 118");
    await page.locator("select").nth(0).selectOption("enb");
    await modalForm.getByRole("button", { name: /^Add Class$/ }).click();
    await expect(page.getByRole("heading", { name: "Add Class" })).toBeHidden();

    await expect(page.getByRole("button", { name: /COP 3514 Data Structures ENB118 9:30 AM - 10:30 AM/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit class" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Edit class" }).first().click();
    await expect(page.getByRole("heading", { name: "Edit Class" })).toBeVisible();
    await page.getByPlaceholder("COP 3514 Data Structures").fill("COP 3514 Algorithms");
    await modalForm.getByRole("button", { name: /^Save change$/ }).click();
    await expect(page.getByRole("heading", { name: "Edit Class" })).toBeHidden();

    await expect(page.getByRole("button", { name: /COP 3514 Algorithms ENB118 9:30 AM - 10:30 AM/ })).toBeVisible();

    await page.getByRole("button", { name: "Edit class" }).first().click();
    await modalForm.getByRole("button", { name: /^Delete$/ }).click();

    await expect(page.getByText("No classes added yet")).toBeVisible();
  });
});
