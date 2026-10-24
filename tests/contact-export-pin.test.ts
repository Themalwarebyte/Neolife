import { describe, expect, it } from "vitest";
import { hashExportPin, isWeakExportPin, verifyExportPin } from "../src/lib/contact-export-pin";

describe("Contact export PIN hashing", () => {
  it("stores only a salted scrypt hash and verifies the correct PIN", async () => {
    const first = await hashExportPin("0482");
    const second = await hashExportPin("0482");
    expect(first).toMatch(/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
    expect(await verifyExportPin("0482", first)).toBe(true);
    expect(await verifyExportPin("8420", first)).toBe(false);
    expect(await verifyExportPin("482", first)).toBe(false);
    expect(isWeakExportPin("0000")).toBe(true);
    expect(isWeakExportPin("1234")).toBe(true);
    expect(isWeakExportPin("0482")).toBe(false);
    await expect(hashExportPin("1111")).rejects.toThrow();
  });
  it("rejects malformed hashes safely", async () => {
    expect(await verifyExportPin("0482", "plain-pin-value")).toBe(false);
    expect(await verifyExportPin("0482", "scrypt$1$1$1$00$00")).toBe(false);
  });
});
