import { recordFunnelEvent } from "@/lib/funnel";
import type {
  ClientFunnelEventInput,
  ClientFunnelEventType,
} from "@/lib/funnel-client";

export async function POST(request: Request): Promise<Response> {
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
