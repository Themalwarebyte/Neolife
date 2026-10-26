import { describe, expect, it } from "vitest";
import { buildContactTransferWhatsAppUrl, normalizeWhatsAppNumber } from "../src/lib/contact-transfer-message";

describe("contact transfer WhatsApp click-to-chat", () => {
  it("normalizes an international number without plus or punctuation", () => {
    expect(normalizeWhatsAppNumber("+254 712-345-678")).toBe("254712345678");
  });
  it("rejects missing, local-leading-zero, and out-of-range phone numbers", () => {
    expect(normalizeWhatsAppNumber(null)).toBeNull();
    expect(normalizeWhatsAppNumber("0712345678")).toBeNull();
    expect(normalizeWhatsAppNumber("12345")).toBeNull();
  });
  it("opens the recipient chat with a prefilled summary and queue link", () => {
    const url = buildContactTransferWhatsAppUrl({ phone: "+254712345678", recipientName: "Amina", count: 30, baseUrl: "https://neolife.ooflowdesk.com" });
    expect(url).toContain("https://wa.me/254712345678?text=");
    const text = decodeURIComponent(url!.split("?text=")[1]);
    expect(text).toContain("30 contact transfer requests");
    expect(text).toContain("/admin/my-contacts?view=queue");
    expect(text).not.toContain("password");
  });
  it("does not generate a WhatsApp link for missing or invalid phone", () => {
    expect(buildContactTransferWhatsAppUrl({ phone: null, recipientName: "Amina", count: 1, baseUrl: "https://neolife.ooflowdesk.com" })).toBeNull();
  });
});
