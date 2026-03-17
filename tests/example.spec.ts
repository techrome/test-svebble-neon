import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");

  // app mounted
  await expect(page.locator("#navbar")).toBeVisible();
});
