/** Pure, auditable rules for access to the private NEOLIFE office. */
export type CrmRole = "admin" | "staff";

export type CrmLoginAccount = {
  isActive: boolean;
  role: string;
  mustChangePassword: boolean;
};

export function isAllowedCrmAccount(
  account: CrmLoginAccount | null | undefined,
): account is CrmLoginAccount & { role: CrmRole } {
  return Boolean(
    account?.isActive &&
    (account.role === "admin" || account.role === "staff"),
  );
}

export function getCrmLoginDestination(account: CrmLoginAccount): string | null {
  if (!isAllowedCrmAccount(account)) return null;
  return account.mustChangePassword ? "/admin/change-password" : "/admin/leads";
}

/** Browser sign-up is forbidden: only Owner provisioning may create CRM users. */
export function isPublicOfficeSignUpPath(pathname: string): boolean {
  let normalized: string;
  try {
    normalized = decodeURIComponent(pathname).replace(/\/+$/, "");
  } catch {
    return true; // malformed encoded paths are never passed to Better Auth
  }
  return /^\/api\/auth\/sign-up(?:\/|$)/i.test(normalized);
}
