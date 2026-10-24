import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { isFourDigitExportPin } from "@/lib/contact-workflow";

const KEY_LENGTH = 32;
const N = 16384;
const R = 8;
const P = 1;
const MAXMEM = 64 * 1024 * 1024;
const COMMON_PINS = new Set(["0000", "0123", "1234", "4321", "1212", "1010", "2580"]);

export function isWeakExportPin(pin: string): boolean {
  return COMMON_PINS.has(pin) || /^(\d)\1{3}$/.test(pin);
}

function derive(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(pin, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashExportPin(pin: string): Promise<string> {
  if (!isFourDigitExportPin(pin) || isWeakExportPin(pin)) throw new Error("PIN must be four digits and must not be an easily guessed pattern.");
  const salt = randomBytes(16);
  const key = await derive(pin, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyExportPin(pin: string, stored: string): Promise<boolean> {
  if (!isFourDigitExportPin(pin) || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== String(N) || parts[2] !== String(R) || parts[3] !== String(P) || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{64}$/.test(parts[5])) return false;
  const actual = await derive(pin, Buffer.from(parts[4], "hex"));
  const expected = Buffer.from(parts[5], "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
