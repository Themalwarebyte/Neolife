import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Task #037 requirement 14 — sendMail forwards `replyTo` as the Resend
 * `reply_to` field while the From identity stays the business sender
 * (EMAIL_FROM). Runs entirely offline: global fetch is stubbed (no network,
 * no real provider, no real key — requirement "no real emails in tests").
 */
describe("Task #037 — sendMail replyTo forwarding (offline)", () => {
  const savedEnv = new Map<string, string | undefined>();
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => "",
  }));

  beforeEach(() => {
    for (const key of ["EMAIL_PROVIDER", "RESEND_API_KEY", "EMAIL_FROM"]) {
      savedEnv.set(key, process.env[key]);
    }
    process.env.EMAIL_PROVIDER = "resend";
    process.env["RESEND_API_KEY"] = "offline-test-placeholder";
    process.env.EMAIL_FROM = "GHub Technologies-Neolife <noreply@mail.ooflowdesk.com>";
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("maps replyTo → reply_to and keeps from = EMAIL_FROM", async () => {
    const { sendMail } = await import("../src/lib/email");
    const result = await sendMail({
      to: "client@example.test",
      subject: "Reply-To routing check",
      text: "body",
      html: "<p>body</p>",
      replyTo: "sender@test.local",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    const body = JSON.parse(init.body) as {
      from: string;
      to: string;
      reply_to?: string;
      text: string;
    };
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["Authorization"]).toMatch(/^Bearer /);
    expect(body.to).toBe("client@example.test");
    expect(body.from).toBe("GHub Technologies-Neolife <noreply@mail.ooflowdesk.com>");
    expect(body.reply_to).toBe("sender@test.local"); // THE requirement-14 behavior
  });

  it("omits reply_to entirely when unset (no accidental routing changes)", async () => {
    const { sendMail } = await import("../src/lib/email");
    await sendMail({
      to: "client@example.test",
      subject: "No reply-to",
      text: "body",
      html: "<p>body</p>",
    });
    const [, init] = fetchMock.mock.calls.at(-1) as unknown as [
      string,
      { body: string },
    ];
    const body = JSON.parse(init.body) as { reply_to?: string };
    expect("reply_to" in body).toBe(false);
  });
});
