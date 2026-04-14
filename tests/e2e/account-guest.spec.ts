import { expect, test } from "@playwright/test";

test.describe("guest account screens", () => {
  test("shows the signed-out saved locations view", async ({ page }) => {
    await page.goto("/saved");

    await expect(page.getByRole("heading", { name: "Saved Locations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to view saved places" })).toBeVisible();
  });

  test("shows the signed-out profile view", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Sign in to unlock your profile" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("button", { name: "Sign In" })).toBeVisible();
  });
});
