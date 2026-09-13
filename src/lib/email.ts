/**
 * Transactional email abstraction (provider-agnostic).
 *
 * Provider is selected by EMAIL_PROVIDER (resend|sendgrid|mailgun|ses|none).
 * No secrets are committed; the API key comes from the environment.
 *
 * Failure handling: send failures are caught and logged server-side with a
 * correlation ID. They NEVER roll back the database record that triggered
 * the notification (per the product-interest workflow).
 */

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendMailResult = { ok: true } | { ok: false; error: string };

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildInterestEmail(input: {
  productName: string;
  productSku?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  message?: string | null;
  source?: string | null;
  campaign?: string | null;
  submittedAt: string;
}): { subject: string; text: string; html: string } {
  const subject = `New product interest: ${input.productName}`;
  const lines = [
    `Product: ${input.productName}`,
    input.productSku ? `SKU: ${input.productSku}` : null,
    `Name: ${input.name}`,
    `Phone: ${input.phone}`,
    input.email ? `Email: ${input.email}` : null,
    input.city ? `Location: ${input.city}` : null,
    input.source ? `Source: ${input.source}` : null,
    input.campaign ? `Campaign: ${input.campaign}` : null,
    `Submitted: ${input.submittedAt}`,
    input.message ? `Message: ${input.message}` : null,
  ].filter((l): l is string => Boolean(l));

  const text = lines.join("\n");
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;">
<h2 style="color:#047857;margin-bottom:0.25em;">New product interest</h2>
<p><strong>Product:</strong> ${escapeHtml(input.productName)}${input.productSku ? ` (SKU: ${escapeHtml(input.productSku)})` : ""}</p>
<p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
<p><strong>Phone:</strong> ${escapeHtml(input.phone)}</p>
${input.email ? `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>` : ""}
${input.city ? `<p><strong>Location:</strong> ${escapeHtml(input.city)}</p>` : ""}
${input.source ? `<p><strong>Source:</strong> ${escapeHtml(input.source)}</p>` : ""}
${input.campaign ? `<p><strong>Campaign:</strong> ${escapeHtml(input.campaign)}</p>` : ""}
<p><strong>Submitted:</strong> ${escapeHtml(input.submittedAt)}</p>
${input.message ? `<p><strong>Message:</strong><br>${escapeHtml(input.message)}</p>` : ""}
<p style="color:#6b7280;font-size:12px;">This is an automated notification from the NEOLIFE product catalogue.</p>
</body></html>`;

  return { subject, text, html };
}

async function sendResend(input: SendMailInput): Promise<SendMailResult> {
  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM");
  if (!apiKey || !from) {
    return { ok: false, error: "RESEND_API_KEY or EMAIL_FROM not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `resend_http_${res.status}${body ? `:${body.slice(0, 200)}` : ""}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown_error" };
  }
}

async function sendDummy(input: SendMailInput): Promise<SendMailResult> {
  if (typeof console !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.info("[email:dummy] would send:", JSON.stringify(input).slice(0, 400));
  }
  return { ok: true };
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const provider = (env("EMAIL_PROVIDER") || "none")?.toLowerCase();
  switch (provider) {
    case "resend":
      return sendResend(input);
    case "none":
    case "dummy":
      return sendDummy(input);
    default:
      return { ok: false, error: `unknown_provider:${provider}` };
  }
}

export function isEmailConfigured(): boolean {
  const provider = (env("EMAIL_PROVIDER") || "").toLowerCase();
  if (provider === "none" || provider === "dummy") return false;
  if (provider === "resend") return Boolean(env("RESEND_API_KEY") && env("EMAIL_FROM"));
  return false;
}