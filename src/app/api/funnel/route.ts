import { recordFunnelEvent } from "@/lib/funnel";
import type {
  ClientFunnelEventInput,
  ClientFunnelEventType,
} from "@/lib/funnel-client";
import { clientKeyFromHeaders, isRateLimited } from "@/lib/rateLimit";

export async function POST(request: Request): Promise<Response> {
  // Keep anonymous analytics traffic in a separate rate-limit bucket from
  // public lead capture, qualification, and interest registration.
  // The existing shared limiter still enforces its established limits.
  try {
    const clientKey = clientKeyFromHeaders(request.headers);
    if (isRateLimited(`funnel:${clientKey}`)) {
      return new Response(null, {
        status: 429,
        headers: { "Cache-Control": "no-store" },
      });
    }
  } catch {
    // A limiter failure must not silently turn this public endpoint into an
    // unthrottled writer. Avoid logging IP addresses or other request data.
    console.warn("[funnel] rate-limit verification failed");
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const body = (await request.json().catch(() => null)) as unknown;

  if (!body || typeof body !== "object") {
    return new Response(null, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  // Client can only emit visitor_landing and registration_start.
  // All other event types are server-side only.
  if (input.type !== "visitor_landing" && input.type !== "registration_start") {
    return new Response(null, { status: 204 });
  }

  await recordFunnelEvent({
    type: input.type,
    deviceId: typeof input.deviceId === "string" ? input.deviceId : null,
    attribution:
      input.attribution && typeof input.attribution === "object"
        ? (input.attribution as Record<string, unknown>)
        : null,
    metadata:
      input.metadata && typeof input.metadata === "object"
        ? (input.metadata as Record<string, unknown>)
        : null,
  });

  return new Response(null, { status: 204 });
}

export type { ClientFunnelEventInput, ClientFunnelEventType };
