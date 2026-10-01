import { describe, expect, it } from "vitest";
import {
  canAssignLeads,
  isAssignableRole,
  canViewLead,
  leadVisibilityWhere,
  OWNER_ROLE,
  STAFF_ROLE,
} from "../src/lib/assignment";

describe("Phase B — assignment authorization (pure, no DB)", () => {
  describe("canAssignLeads", () => {
    it("Owner (admin) can assign leads", () => {
      expect(canAssignLeads(OWNER_ROLE)).toBe(true);
    });

    it("Staff cannot assign leads", () => {
      expect(canAssignLeads(STAFF_ROLE)).toBe(false);
    });

    it("undefined role cannot assign leads", () => {
      expect(canAssignLeads(undefined)).toBe(false);
    });
  });

  describe("isAssignableRole", () => {
    it("Staff is a valid assignee", () => {
      expect(isAssignableRole(STAFF_ROLE)).toBe(true);
    });

    it("Owner (admin) is NOT a valid assignee", () => {
      expect(isAssignableRole(OWNER_ROLE)).toBe(false);
    });

    it("unknown role is not a valid assignee", () => {
      expect(isAssignableRole("superadmin")).toBe(false);
    });
  });

  describe("canViewLead (ownership boundary)", () => {
    it("Owner can view any lead (assigned or unassigned)", () => {
      expect(canViewLead(OWNER_ROLE, "owner-1", null)).toBe(true);
      expect(canViewLead(OWNER_ROLE, "owner-1", "staff-1")).toBe(true);
    });

    it("Staff can view their own assigned lead", () => {
      expect(canViewLead(STAFF_ROLE, "staff-1", "staff-1")).toBe(true);
    });

    it("Staff cannot view an unassigned lead", () => {
      expect(canViewLead(STAFF_ROLE, "staff-1", null)).toBe(false);
    });

    it("Staff cannot view a lead assigned to another staff user", () => {
      expect(canViewLead(STAFF_ROLE, "staff-1", "staff-2")).toBe(false);
    });

    it("undefined role cannot view any lead", () => {
      expect(canViewLead(undefined, "user-1", "user-1")).toBe(false);
    });
  });

  describe("leadVisibilityWhere (query scoping)", () => {
    it("Owner sees all leads (empty filter)", () => {
      expect(leadVisibilityWhere(OWNER_ROLE, "owner-1")).toEqual({});
    });

    it("Staff sees only their assigned leads", () => {
      expect(leadVisibilityWhere(STAFF_ROLE, "staff-1")).toEqual({
        assignedUserId: "staff-1",
      });
    });

    it("Non-authenticated user sees no leads", () => {
      expect(leadVisibilityWhere(undefined, undefined)).toEqual({
        id: null,
      });
    });

    it("Staff with no userId sees no leads", () => {
      expect(leadVisibilityWhere(STAFF_ROLE, undefined)).toEqual({ id: null });
    });
  });
});
