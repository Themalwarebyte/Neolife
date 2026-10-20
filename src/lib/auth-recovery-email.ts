/** Pure formatting for an authentication email. Never log or persist the reset URL. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildOfficeResetEmail(url: string): {
  subject: string;
  text: string;
  html: string;
} {
  // Never accept a javascript:/data:/relative link in an auth email.
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" &&
        parsed.protocol === "http:" &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"))) {
    throw new Error("Invalid password-recovery link origin.");
  }
  const safe = escapeHtml(parsed.href);
  return {
    subject: "Reset your NEOLIFE Office password",
    text: `A password reset was requested for your NEOLIFE Office account.\n\nOpen this link to continue:\n${parsed.href}\n\nIf you did not request this, ignore this message. Do not share the link.`,
    html: `<!doctype html><html><body style="margin:0;padding:32px;background:#fbf3f8;font-family:Arial,Helvetica,sans-serif;color:#2b0f20"><main style="max-width:520px;margin:auto;background:white;border:1px solid #ecd2e2;border-radius:20px;padding:32px"><p style="color:#70234d;font-size:12px;letter-spacing:2px;font-weight:bold">NEOLIFE OFFICE</p><h1 style="font-size:25px">Reset your password</h1><p>We received a request to reset the password for your office account.</p><p><a href="${safe}" style="background:#70234d;color:white;display:inline-block;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Reset password</a></p><p style="font-size:13px;color:#675866">If the button does not open, copy this link into your browser:</p><p style="overflow-wrap:anywhere;font-size:13px"><a href="${safe}">${safe}</a></p><p style="color:#675866;font-size:13px">If you did not request this change, ignore this email. Never share your reset link.</p></main></body></html>`,
  };
}
