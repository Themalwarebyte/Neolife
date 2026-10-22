import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/funnel/route";
import { recordFunnelEvent } from "@/lib/funnel";
import { clientKeyFromHeaders, isRateLimited } from "@/lib/rateLimit";

vi.mock("@/lib/funnel", () => ({
  recordFunnelEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/rateLimit", () => ({
  clientKeyFromHeaders: vi.fn(() => "isolated-client"),
  isRateLimited: vi.fn(() => false),
}));

function post(body: unknown): Request {
  return new Request("https://neolife.ooflowdesk.com/api/funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.12" },
    body: JSON.stringify(body),
  });
}

describe("public funnel route rate-limit protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientKeyFromHeaders).mockReturnValue("isolated-client");
    vi.mocked(isRateLimited).mockReturnValue(false);
  });

  it("isolates funnel traffic from registration and qualification buckets", async () => {
    const request = post({ type: "visitor_landing", deviceId: "device-test" });
    expect((await POST(request)).status).toBe(204);
    expect(clientKeyFromHeaders).toHaveBeenCalledWith(request.headers);
    expect(isRateLimited).toHaveBeenCalledWith("funnel:isolated-client");
    expect(recordFunnelEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "visitor_landing", deviceId: "device-test" }),
    );
  });

  it("returns 429 without recording an event when throttled", async () => {
    vi.mocked(isRateLimited).mockReturnValue(true);
    const response = await POST(post({ type: "visitor_landing" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(recordFunnelEvent).not.toHaveBeenCalled();
  });

  it("fails closed on rate-limit errors without persisting an event", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      vi.mocked(isRateLimited).mockImplementation(() => {
        throw new Error("limiter unavailable");
      });
      const response = await POST(post({ type: "visitor_landing" }));
      expect(response.status).toBe(503);
      expect(recordFunnelEvent).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith("[funnel] rate-limit verification failed");
    } finally {
      warn.mockRestore();
    }
  });

  it("rejects malformed JSON with 400 after rate-limit evaluation", async () => {
    const request = new Request("https://neolife.ooflowdesk.com/api/funnel", {
      method: "POST",
      body: "{not-json",
    });
    expect((await POST(request)).status).toBe(400);
    expect(isRateLimited).toHaveBeenCalledTimes(1);
    expect(recordFunnelEvent).not.toHaveBeenCalled();
  });

  it("does not accept server-only event types from the client", async () => {
    expect((await POST(post({ type: "lead_qualified" }))).status).toBe(204);
    expect(recordFunnelEvent).not.toHaveBeenCalled();
  });

  it("continues accepting registration_start events", async () => {
    expect((await POST(post({ type: "registration_start" }))).status).toBe(204);
    expect(recordFunnelEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "registration_start" }),
    );
  });
});
