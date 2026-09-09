import { describe, expect, it } from "vitest";
import {
  parseMeetingStatus,
  parseOptionalText,
  parseScheduledAt,
} from "../src/lib/meetingManagement";

describe("meeting validation", () => {
  it("accepts valid meeting statuses", () => {
    expect(parseMeetingStatus("SCHEDULED")).toBe("SCHEDULED");
    expect(parseMeetingStatus("ATTENDED")).toBe("ATTENDED");
    expect(parseMeetingStatus("NO_SHOW")).toBe("NO_SHOW");
    expect(parseMeetingStatus("RESCHEDULED")).toBe("RESCHEDULED");
  });

  it("rejects invalid meeting statuses", () => {
    expect(parseMeetingStatus("WHATEVER")).toBeNull();
    expect(parseMeetingStatus(42)).toBeNull();
    expect(parseMeetingStatus("")).toBeNull();
  });

  it("parses a valid datetime and rejects invalid ones", () => {
    expect(parseScheduledAt("2026-09-15T14:30")).toBeInstanceOf(Date);
    expect(parseScheduledAt("")).toBeNull();
    expect(parseScheduledAt("not-a-date")).toBeNull();
    expect(parseScheduledAt(123)).toBeNull();
  });

  it("validates optional text (empty -> undefined, too long -> null)", () => {
    expect(parseOptionalText("  Attendee interested  ")).toBe("Attendee interested");
    expect(parseOptionalText("")).toBeUndefined();
    expect(parseOptionalText("   ")).toBeUndefined();
    expect(parseOptionalText(null)).toBeUndefined();
    expect(parseOptionalText("x".repeat(501))).toBeNull();
  });
});
