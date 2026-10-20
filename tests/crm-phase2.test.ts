import { describe, it, expect } from "vitest";
import {
  parseLeadFilters, leadQueryString, parseFollowUpDueAt, parseFollowUpWindow,
  followUpLabel, percentOf,
} from "../src/lib/crm-phase2";

describe("Phase 2 pure CRM helpers", () => {
  it("normalizes search and enforces allowed filters", () => {
    const f = parseLeadFilters({q:"  Jane  ", status:"QUALIFIED", interest:"BUSINESS", assignment:"unassigned", page:"3"}, true);
    expect(f).toEqual({q:"Jane",status:"QUALIFIED",interest:"BUSINESS",assignment:"unassigned",page:3});
    expect(leadQueryString(f, 3)).toContain("page=3");
  });
  it("rejects invented status, negative pages, and staff assignment scope", () => {
    const f = parseLeadFilters({ status:"UNKNOWN", interest:"ROOT", assignment:"unassigned", page:"-9"}, false);
    expect(f).toEqual({ q:"",status:"",interest:"",assignment:"mine",page:1 });
  });
  it("bounds search and does not accept exotic numeric pages", () => {
    expect(parseLeadFilters({ q:"x".repeat(300), page:"1e3" }, true).q).toHaveLength(100);
    expect(parseLeadFilters({ page:"1e3" }, true).page).toBe(1);
    expect(parseLeadFilters({ page:"100001" }, true).page).toBe(1);
  });
  it("accepts optional notes and a valid UTC due date", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    expect(parseFollowUpDueAt("",now)).toEqual({dueAt:null,valid:true});
    expect(parseFollowUpDueAt("2026-10-21T13:00:00.000Z",now).dueAt?.toISOString()).toBe("2026-10-21T13:00:00.000Z");
  });
  it("rejects naive datetimes, past, and far future dates", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    for (const invalid of ["2026-10-20T14:00", "yesterday", "2026-10-19T12:00:00.000Z", "2035-10-20T12:00:00.000Z"]) {
      expect(parseFollowUpDueAt(invalid, now).valid).toBe(false);
    }
  });
  it("has clear queue/status and zero-safe conversion labels", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    expect(followUpLabel(new Date("2026-10-19T12:00:00.000Z"),null,now)).toBe("Overdue");
    expect(followUpLabel(new Date("2026-10-19T12:00:00.000Z"),now,now)).toBe("Completed");
    expect(parseFollowUpWindow("garbage")).toBe("all");
    expect(percentOf(4,0)).toBe("0.0%");
    expect(percentOf(1,4)).toBe("25.0%");
  });
});
