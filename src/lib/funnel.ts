/**
 * Phase D — first-party funnel event recording (D-029).
 *
 * This module provides a narrow server-side abstraction for recording
 * FunnelEvent entries. It validates inputs at the boundary and prevents
 * arbitrary event types or unsafe metadata from being persisted.
 *
 * FunnelEvent is SEPARATE from LeadEvent:
 * - LeadEvent = CRM audit trail (authenticated CRM user actions)
 * - FunnelEvent = first-party funnel/traffic measurement (anonymous by default)
 *
 * Security:
 * - No PII is ever stored in FunnelEvent (no phone, email, name).
 * - No IP addresses or User-Agent strings are stored (per D-031).
 * - Attribution is re-validated before persistence via parseAttribution().
 * - Event types are restricted to an approved enum (no client-controlled types).
 * - Rate limiting is the caller's responsibility (see D-13).
 */

import { prisma } from "@/server/db/prisma";
import { parseAttribution, type Attribution } from "@/lib/attribution";

export type FunnelEventType =
  | "visitor_landing"
  | "lead_created"
  | "lead_qualified"
  | "registration_start"
  | "registration_complete";

const VALID_FUNNEL_EVENT_TYPES: ReadonlySet<string> = new Set([
  "visitor_landing",
  "lead_created",
  "lead_qualified",
  "registration_start",
  "registration_complete",
]);

/** Sanitizes attribution input for persistence (drops invalid values, never invents). */
export function sanitizeAttributionForFunnel(attribution: unknown): Record<string, string> | null {
  if (!attribution || typeof attribution !== "object") return null;
  const validated = parseAttribution(attribution as AttributedInput);
  return validated;
}

interface AttributedInput {
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
  content?: unknown;
  term?: unknown;
  landingPage?: unknown;
  firstTouchSource?: unknown;
}

/**
 * Records a funnel event in the database.
 *
 * @param type - Must be one of the approved event types.
 * @param attribution - Validated first-party attribution (re-validated here).
 * @param leadId - Optional; the lead this event concerns (if applicable).
 * @param deviceId - Optional; first-party anonymous device correlation ID.
 * @param metadata - Optional; event-specific metadata (validated for safe keys/values).
 */
export async function recordFunnelEvent(params: {
  type: string;
  attribution?: Attribution | null;
  leadId?: string | null;
  deviceId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  // Validate event type — reject anything not in the approved set.
  if (!VALID_FUNNEL_EVENT_TYPES.has(params.type)) {
    return; // Silently reject unknown event types.
  }

  // Re-validate attribution at the boundary (never trust client input).
  const safeAttribution =
    params.attribution && typeof params.attribution === "object"
      ? (sanitizeAttributionForFunnel(params.attribution) as Record<string, unknown> | null)
      : null;

  // Sanitize metadata: only allow string/number/boolean values with safe keys.
  let safeMetadata: Record<string, unknown> | null = null;
  if (params.metadata && typeof params.metadata === "object") {
    safeMetadata = {};
    for (const [key, value] of Object.entries(params.metadata)) {
      // Only allow simple alphanumeric keys.
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) continue;
      // Only allow primitive values (no nested objects/arrays to prevent injection).
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        safeMetadata[key] = value;
      }
    }
    if (Object.keys(safeMetadata).length === 0) safeMetadata = null;
  }

  // Validate deviceId format (must be a UUID if provided).
  let safeDeviceId: string | null = null;
  if (params.deviceId && typeof params.deviceId === "string") {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    safeDeviceId = UUID.test(params.deviceId) ? params.deviceId : null;
  }

  await prisma.funnelEvent.create({
    data: {
      type: params.type,
      leadId: params.leadId ?? undefined,
      attribution: safeAttribution as never,
      deviceId: safeDeviceId,
      metadata: safeMetadata as never,
    },
  });
}
