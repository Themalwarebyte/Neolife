/**
 * Phase P-1 / Phase D — shared first-party device correlation (D-031).
 *
 * Client-side utility for obtaining or creating the anonymous device ID
 * used by FunnelEvent tracking. The ID is a random UUID v4 stored in
 * first-party localStorage — no cookies, no IP, no User-Agent, no
 * fingerprinting.
 *
 * This centralizes the device-ID logic that was previously duplicated
 * between FunnelTracker.tsx and LeadForm.tsx.
 */

export const FUNNEL_DEVICE_KEY = "neolife.funnel_device";

/**
 * Returns the existing anonymous device ID from localStorage, or creates
 * and stores a new one. Returns null if localStorage is unavailable.
 */
export function getOrCreateDeviceId(): string | null {
  if (typeof window === "undefined" || !window?.localStorage) return null;
  try {
    let id = window.localStorage.getItem(FUNNEL_DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(FUNNEL_DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
