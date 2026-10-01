import { describe, expect, it } from "vitest";
import {
  createUserSchema,
  toggleUserSchema,
  changePasswordSchema,
} from "../src/lib/user-management";

describe("User management schemas (pure, no DB)", () => {
  describe("createUserSchema", () => {
    it("accepts a valid user payload", () => {
      expect(
        createUserSchema.safeParse({
          name: "John Doe",
          email: "john@example.com",
          password: "securepassword123",
        }).success,
      ).toBe(true);
    });

    it("rejects an invalid email", () => {
      const result = createUserSchema.safeParse({
        name: "John Doe",
        email: "not-an-email",
        password: "securepassword123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a password shorter than 8 characters", () => {
      const result = createUserSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty name", () => {
      const result = createUserSchema.safeParse({
        name: "",
        email: "john@example.com",
        password: "securepassword123",
      });
      expect(result.success).toBe(false);
    });

    it("does not accept a role field (hardcoded as staff)", () => {
      const result = createUserSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
        password: "securepassword123",
        role: "admin",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("toggleUserSchema", () => {
    it("accepts a valid UUID", () => {
      expect(
        toggleUserSchema.safeParse({
          userId: "550e8400-e29b-41d4-a716-446655440000",
        }).success,
      ).toBe(true);
    });

    it("accepts a Better Auth-style user ID (opaque alphanumeric, non-UUID)", () => {
      // Better Auth generates ~31-char alphanumeric IDs (see
      // @better-auth/core generateId). These are the IDs actually stored in
      // the User table and bound into the deactivation form.
      const betterAuthStyleId = "aB3xK9mQ2vR7wL5pT0yZ8cD4fG6hJ1n";
      expect(betterAuthStyleId).toMatch(/^[A-Za-z0-9]{31}$/);
      expect(
        toggleUserSchema.safeParse({ userId: betterAuthStyleId }).success,
      ).toBe(true);
    });

    it("rejects a short garbage string", () => {
      const result = toggleUserSchema.safeParse({
        userId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a string with disallowed characters", () => {
      // Long enough to pass a length-only check — must still fail on charset.
      const result = toggleUserSchema.safeParse({
        userId: "<script>alert(1)</script>____padding",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty string", () => {
      const result = toggleUserSchema.safeParse({ userId: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("changePasswordSchema", () => {
    it("accepts matching passwords of sufficient length", () => {
      expect(
        changePasswordSchema.safeParse({
          currentPassword: "temp-password-123",
          newPassword: "newsecurepassword",
          confirmPassword: "newsecurepassword",
        }).success,
      ).toBe(true);
    });

    it("rejects when new and confirm passwords do not match", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "temp-password-123",
        newPassword: "newsecurepassword",
        confirmPassword: "differentpassword",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toEqual(["confirmPassword"]);
    });

    it("rejects when currentPassword is empty", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: "newsecurepassword",
        confirmPassword: "newsecurepassword",
      });
      expect(result.success).toBe(false);
    });

    it("rejects when newPassword is shorter than 8 characters", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "currentpassword",
        newPassword: "short",
        confirmPassword: "short",
      });
      expect(result.success).toBe(false);
    });
  });
});
