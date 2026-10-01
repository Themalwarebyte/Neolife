import { expect, test } from "@playwright/test";

/**
 * Phase P-1 — Registration / business-interest form E2E (D-026, D-032).
 *
 * Requires a running local server + PostgreSQL (see playwright.config.ts webServer).
 * Verifies the public journey: lead capture → qualification page → registration form
 * submission → success state. Does NOT verify Meeting creation (D-032: registration
 * does NOT create a Meeting).
 */
test.describe("Phase P-1 — registration flow", () => {
  test("qualify page shows registration form alongside qualification form", async ({
    page,
  }) => {
    // Navigate directly to the qualify page with a dummy token.
    // We cannot complete the full flow without a valid DB-backed token, but
    // we can verify the page renders the RegistrationForm section.
    await page.goto("/register-interest/qualify?token=dummy");

    // The page should show both the qualification and registration sections
    await expect(
      page.getByRole("heading", { name: "Tell us more about your interest" }),
    ).toBeVisible();

    await expect(
      page.getByText("Product interest"),
    ).toBeVisible();

    // The RegistrationForm should render a product dropdown
    await expect(page.getByLabel("Product I am most interested in")).toBeVisible();

    // Meeting preference radios should be present
    await expect(page.getByText("Preferred meeting format")).toBeVisible();
    await expect(page.getByLabel("Video call")).toBeVisible();
    await expect(page.getByLabel("In-person at the office")).toBeVisible();
    await expect(page.getByLabel("Phone call")).toBeVisible();

    // Additional context textarea should be present
    await expect(page.getByLabel("Additional context")).toBeVisible();
  });

   test("registration form shows token error for invalid token", async ({
    page,
  }) => {
    await page.goto("/register-interest/qualify?token=dummy");

    // Submit without selecting a product or meeting preference
    await page.getByRole("button", { name: "Record my interest" }).click();

    // Token is validated server-side before field-level validation, so an
    // invalid token yields a top-level form error rather than field errors.
    await expect(
      page.getByText(/This link has expired or has already been used/),
    ).toBeVisible();
  });
});

/**
 * Full end-to-end registration journey:
 * landing page → lead capture → qualify page (with token) → registration form
 *
 * This test requires a running server + PostgreSQL with seeded products.
 * It is skipped if the server is not reachable.
 */
test.describe("Phase P-1 — registration E2E (requires server + DB)", () => {
  test("lead capture → qualify page → registration form visible", async ({
    page,
  }) => {
    // Use a unique phone per run so we don't hit the existing-lead path
    // (which returns a different message without a qualification token).
    const uniquePhone = `+254771${Date.now().toString().slice(-7).padStart(7, "0")}`;

    await page.goto("/");

    // Navigate to register interest
    await page.getByRole("link", { name: "Register Your Interest" }).first().click();
    await expect(page).toHaveURL(/\/register-interest$/);

    // Fill and submit lead form
    await page.getByLabel("First name").fill("RegE2E");
    await page.getByLabel("Phone").fill(uniquePhone);
    await page
      .getByLabel("I am interested in")
      .selectOption({ label: "The business opportunity" });
    await page.getByLabel(/I consent to the NEOLIFE office team/).check();
    await page.getByRole("button", { name: "Submit My Interest" }).click();

    // Should reach success state with qualification link
    await expect(
      page.getByRole("heading", { name: "Interest registered" }),
    ).toBeVisible({ timeout: 15000 });

    // Click "Continue to qualification"
    await page.getByRole("link", { name: "Continue to qualification" }).click();
    await expect(page).toHaveURL(/\/register-interest\/qualify\?token=/);

    // Registration form should be visible on the qualify page
    await expect(page.getByText("Product interest")).toBeVisible();
    await expect(page.getByLabel("Product I am most interested in")).toBeVisible();
  });
});
