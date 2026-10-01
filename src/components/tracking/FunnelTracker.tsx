"use client";

import { useEffect, useState } from "react";
import { recordFunnelEventClient } from "@/lib/funnel-client";
import { deserializeAttribution } from "@/lib/attribution";
import { ATTRIBUTION_STORAGE_KEY } from "@/lib/attribution";
import { getOrCreateDeviceId } from "@/lib/funnel-device";

const LANDING_DEBOUNCE_KEY = "neolife.funnel_landing_ts";
const LANDING_DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Phase D — first-party funnel tracker (D-029).
 *
 * Records a `visitor_landing` FunnelEvent when the landing page loads
 * with UTM parameters present. Deduplicates client-side via localStorage
 * (10-minute cooldown per device). This is NOT authoritative security —
 * client-side dedup is best-effort only (visitors can manipulate localStorage).
 *
 * Never blocks the page from functioning. A tracking failure is silently
 * ignored and never prevents lead capture, qualification, or CRM operation.
 *
 * Stores a non-PII `deviceId` (random UUID v4) in first-party localStorage
 * for anonymous visitor correlation. No fingerprinting, no cookies, no IP
 * or User-Agent collection.
 */
export function FunnelTracker() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !mounted) return;
    void recordLandingEvent();
  }, [mounted]);

  async function recordLandingEvent() {
    try {
      // Generate or retrieve the anonymous device ID.
      const deviceId = getOrCreateDeviceId();
      if (!deviceId) return;

      // Client-side debounce: max 1 landing event per device per 10 minutes.
      const now = Date.now();
      const lastSent = parseInt(
        window.localStorage.getItem(LANDING_DEBOUNCE_KEY) ?? "0",
        10,
      );
      if (now - lastSent < LANDING_DEBOUNCE_MS) return;

      // Only record a landing event if attribution (UTM params) are present.
      const attribution = deserializeAttribution(
        window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY),
      );
      if (!attribution) return;

      await recordFunnelEventClient({
        type: "visitor_landing",
        deviceId,
        attribution,
        metadata: {
          landingPage: window.location.pathname,
        },
      });

      window.localStorage.setItem(LANDING_DEBOUNCE_KEY, String(now));
    } catch {
      // Funnel tracking must never break the page.
    }
  }

  return null;
}
