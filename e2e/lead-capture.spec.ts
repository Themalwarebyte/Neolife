import { expect, test } from "@playwright/test";

/**
 * Core MVP funnel journey (Task 1.5):
 * landing page → register interest → valid form → success state.
 * Full DB assertions live in the smoke test + unit tests; this E2E proves the
 * public journey works end to end.
 */
test("lead capture journey: landing page → register interest → success", async ({
  page,
}) => {
  await page.goto("/");

  // 1. Landing page renders and CTA navigates to the lead form
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Build a health and wellness business",
  );
  await page.getByRole("link", { name: "Register Your Interest" }).first().click();
  await expect(page).toHaveURL(/\/register-interest$/);

  // 2. Submitting without consent shows a validation error
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Phone").fill("+254700000001");
  await page
    .getByLabel("I am interested in")
    .selectOption({ label: "The business opportunity" });
  await page.getByRole("button", { name: "Submit My Interest" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();

  // 3. Complete valid submission reaches the success state
  await page.getByLabel(/I am happy for the NEOLIFE office team/).check();
  await page.getByRole("button", { name: "Submit My Interest" }).click();
  await expect(
    page.getByRole("heading", { name: "Interest registered" }),
  ).toBeVisible();
});
