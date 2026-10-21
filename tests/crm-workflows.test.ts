import { describe, expect, it } from "vitest";
import {
  MAX_WORKFLOW_BATCH,
  parseWorkflowSelection,
  parseExpectedTaskDate,
  isChangedTaskDueAt,
} from "@/lib/crm-workflows";

const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("Phase 28 workflow validation", () => {
  it("accepts 1–25 unique UUIDs and canonicalizes their casing", () => {
    expect(parseWorkflowSelection([a.toUpperCase(), b])).toEqual({ valid: true, ids: [a, b] });
    expect(parseWorkflowSelection([a]).valid).toBe(true);
  });
  it("rejects empty, oversized, duplicates, malformed IDs, and non-strings", () => {
    expect(parseWorkflowSelection([]).valid).toBe(false);
    expect(parseWorkflowSelection(new Array(MAX_WORKFLOW_BATCH + 1).fill(a)).valid).toBe(false);
    expect(parseWorkflowSelection([a, a.toUpperCase()]).valid).toBe(false);
    expect(parseWorkflowSelection([a, "not-a-uuid"]).valid).toBe(false);
    expect(parseWorkflowSelection([a, null]).valid).toBe(false);
    expect(parseWorkflowSelection([b, 123]).valid).toBe(false);
  });
  it("checks old due dates as strict UTC instants, including past tasks", () => {
    expect(parseExpectedTaskDate("2020-01-01T12:00:00.000Z")?.toISOString()).toBe("2020-01-01T12:00:00.000Z");
    expect(parseExpectedTaskDate("2020-01-01T12:00:00Z")?.toISOString()).toBe("2020-01-01T12:00:00.000Z");
    expect(parseExpectedTaskDate("2020-02-30T12:00:00.000Z")).toBeNull();
    expect(parseExpectedTaskDate("not-a-date")).toBeNull();
    expect(parseExpectedTaskDate(null)).toBeNull();
  });
  it("compares timestamps rather than date object identity", () => {
    const a = new Date("2026-10-21T11:00:00.000Z");
    expect(isChangedTaskDueAt(a, new Date(a))).toBe(false);
    expect(isChangedTaskDueAt(a, new Date(a.getTime() + 60_000))).toBe(true);
  });
});
