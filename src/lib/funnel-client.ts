/**
 * Phase D — client-side funnel event proxy (D-029).
 *
 * Provides a client-safe interface for recording funnel events.
 * Delegates to the server API route `/api/funnel`.
 *
 * This is the ONLY client-allowed funnel event recorder. All validation
 * happens server-side — the client cannot specify arbitrary event types
 * or inject unsafe metadata.
 */

export type ClientFunnelEventType = "visitor_landing" | "registration_start";

export type ClientFunnelEventInput = {
  type: ClientFunnelEventType;
  deviceId?: string;
  attribution?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

/**
 * Records a funnel event via the server API route.
 * Client can emit `visitor_landing` and `registration_start` events —
 * all other event types (lead_created, lead_qualified, registration_complete)
 * are recorded server-side only.
 */
export async function recordFunnelEventClient(
  input: ClientFunnelEventInput,
): Promise<void> {
  await fetch("/api/funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => {
    /* Funnel tracking must never break the page. */
  });
}
