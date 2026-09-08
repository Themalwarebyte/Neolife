"use client";

import { useEffect } from "react";
import {
  ATTRIBUTION_STORAGE_KEY,
  deserializeAttribution,
  parseAttributionFromSearchParams,
  resolveFirstTouch,
  serializeAttribution,
} from "@/lib/attribution";

/**
 * Task 1.4 — first-touch attribution capture (first-party, no cookies).
 * Mounts in the root layout; on any landing URL with UTM parameters it stores
 * the attribution on the visitor's device (localStorage) unless a first-touch
 * attribution already exists. Renders nothing.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      const incoming = parseAttributionFromSearchParams(
        new URLSearchParams(window.location.search),
      );
      if (!incoming) return;

      const withLandingPage = {
        ...incoming,
        landingPage: incoming.landingPage ?? window.location.pathname,
      };

      const existing = deserializeAttribution(
        window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY),
      );
      const resolved = resolveFirstTouch(existing, withLandingPage);
      window.localStorage.setItem(
        ATTRIBUTION_STORAGE_KEY,
        serializeAttribution(resolved),
      );
    } catch {
      // Attribution must never break the page.
    }
  }, []);

  return null;
}
