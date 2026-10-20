import { describe, expect, it } from "vitest";
import { getCrmLoginDestination, isAllowedCrmAccount, isPublicOfficeSignUpPath } from "../src/lib/crm-login-policy";

describe("NEOLIFE private office access policy", () => {
  it("allows only active Owner and Staff", () => {
    expect(isAllowedCrmAccount({ role: "admin", isActive: true, mustChangePassword: false })).toBe(true);
    expect(isAllowedCrmAccount({ role: "staff", isActive: true, mustChangePassword: false })).toBe(true);
  });
  it("denies deactivated accounts even if a session previously existed", () => {
    expect(isAllowedCrmAccount({ role: "admin", isActive: false, mustChangePassword: false })).toBe(false);
    expect(isAllowedCrmAccount({ role: "staff", isActive: false, mustChangePassword: false })).toBe(false);
  });
  it("denies other roles and missing users", () => {
    expect(isAllowedCrmAccount({ role: "visitor", isActive: true, mustChangePassword: false })).toBe(false);
    expect(isAllowedCrmAccount(null)).toBe(false);
  });
  it("blocks public HTTP sign-up paths but not ordinary auth endpoints", () => {
    expect(isPublicOfficeSignUpPath("/api/auth/sign-up/email")).toBe(true);
    expect(isPublicOfficeSignUpPath("/api/auth/sign-up/email/")).toBe(true);
    expect(isPublicOfficeSignUpPath("/api/auth/sign-in/email")).toBe(false);
    expect(isPublicOfficeSignUpPath("/api/auth/sign-out")).toBe(false);
    expect(isPublicOfficeSignUpPath("/api/auth/request-password-reset")).toBe(false);
  });
  it("forces initial password change before CRM entry", () => {
    expect(getCrmLoginDestination({ role: "admin", isActive: true, mustChangePassword: true })).toBe("/admin/change-password");
    expect(getCrmLoginDestination({ role: "staff", isActive: true, mustChangePassword: true })).toBe("/admin/change-password");
  });
  it("routes both authorized roles to their scoped CRM", () => {
    expect(getCrmLoginDestination({ role: "admin", isActive: true, mustChangePassword: false })).toBe("/admin/leads");
    expect(getCrmLoginDestination({ role: "staff", isActive: true, mustChangePassword: false })).toBe("/admin/leads");
    expect(getCrmLoginDestination({ role: "staff", isActive: false, mustChangePassword: true })).toBeNull();
  });
});
