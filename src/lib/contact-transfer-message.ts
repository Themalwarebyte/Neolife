export function normalizeWhatsAppNumber(value: string | null | undefined): string | null {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return digits;
}

export function buildContactTransferWhatsAppUrl(input: { phone: string | null | undefined; recipientName: string; count: number; baseUrl: string }): string | null {
  if (!Number.isSafeInteger(input.count) || input.count < 1 || input.count > 100) return null;
  const phone = normalizeWhatsAppNumber(input.phone);
  if (!phone) return null;
  const name = input.recipientName.trim().replace(/[\r\n\t]/g, " ").slice(0, 80) || "there";
  let base: URL;
  try { base = new URL(input.baseUrl); } catch { return null; }
  if (base.protocol !== "https:" && base.hostname !== "localhost") return null;
  const noun = input.count === 1 ? "contact transfer request" : "contact transfer requests";
  const message = "Hi " + name + ", you have " + input.count + " " + noun + " awaiting your approval in NEOLIFE. Please open My Contacts and review Incoming Contact Transfers. After approval, check your Imported Queue or Main Contacts as appropriate: " + base.origin + "/admin/my-contacts?view=queue";
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
}
