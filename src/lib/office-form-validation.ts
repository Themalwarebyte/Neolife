/** Client-safe office form validation. Server authentication is authoritative. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOfficeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidOfficeEmail(value: string): boolean {
  const email = normalizeOfficeEmail(value);
  return email.length <= 254 && EMAIL.test(email);
}

export function isValidOfficePassword(value: string): boolean {
  return value.length >= 8 && value.length <= 128;
}

export function officePasswordMismatch(password: string, confirmation: string): boolean {
  return password !== confirmation;
}
