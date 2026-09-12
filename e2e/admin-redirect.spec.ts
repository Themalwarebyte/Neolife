import { expect, test } from "@playwright/test";

/**
 * /admin entry point (Owner-approved):
 * unauthenticated visitors are redirected server-side to /admin/login.
 */
test("unauthenticated /admin redirects to /admin/login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to the CRM" }),
  ).toBeVisible();
});
