import { describe, expect, it } from "vitest";
import { buildOfficeResetEmail } from "../src/lib/auth-recovery-email";

describe("NEOLIFE password recovery emails", () => {
  it("uses NEOLIFE mulberry branding and a working HTTPS link", () => {
    const link = "https://neolife.ooflowdesk.com/api/auth/reset-password/opaque?callbackURL=%2Fadmin%2Freset-password";
    const email = buildOfficeResetEmail(link);
    expect(email.subject).toMatch(/NEOLIFE/);
    expect(email.text).toContain(link);
    expect(email.html).toContain('href="https://neolife.ooflowdesk.com');
    expect(email.html).toContain("#70234d");
  });
  it("escapes special characters in HTML link attributes", () => {
    const result = buildOfficeResetEmail("https://example.com/reset?first=1&second=2");
    expect(result.html).toContain("first=1&amp;second=2");
    expect(result.html).not.toContain('first=1&second=2"');
  });
  it("refuses unsafe callback URLs", () => {
    expect(() => buildOfficeResetEmail("javascript:alert(1)")).toThrow();
    expect(() => buildOfficeResetEmail("data:text/html,bad")).toThrow();
  });
});
