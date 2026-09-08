import { describe, expect, it } from "vitest";
import { isRateLimited } from "../src/lib/rateLimit";

describe("isRateLimited (basic abuse control)", () => {
  it("allows up to 5 requests per window then blocks", () => {
    const key = `test-key-${Math.random()}`;
    const results = [];
    for (let i = 0; i < 6; i += 1) {
      results.push(isRateLimited(key));
    }
    expect(results).toEqual([false, false, false, false, false, true]);
  });

  it("does not block unrelated keys", () => {
    expect(isRateLimited("another-key-1")).toBe(false);
  });
});
