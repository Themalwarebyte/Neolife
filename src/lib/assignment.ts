/**
 * Phase B — pure authorization helpers for lead assignment (client-safe, no Prisma).
 *
 * These functions encode the Owner-approved assignment policy:
 *   - Only the Owner (role "admin") can assign/reassign leads.
 *   - Staff (role "staff") cannot assign leads.
 *   - Only Staff users can be lead assignees (not admin, not arbitrary).
 *   - Staff see only their assigned leads; Owner sees all.
 *
 * Kept client-safe (no generated Prisma import) so these can be unit-tested
 * without a database connection and imported in client components for UI gating.
 */

export const OWNER_ROLE = "admin" as const;
export const STAFF_ROLE = "staff" as const;

/** Returns true if the role can assign/reassign leads (Owner only). */
export function canAssignLeads(role: string | undefined): boolean {
  return role === OWNER_ROLE;
}

/** Returns true if the role is a valid lead assignee (Staff only). */
export function isAssignableRole(role: string | undefined): boolean {
  return role === STAFF_ROLE;
}

/**
 * Returns true if the given user can view the lead with the specified assignee.
 * - Owner (admin) sees all leads.
 * - Staff (colleague) sees only leads assigned to them.
 */
export function canViewLead(
  role: string | undefined,
  userId: string | undefined,
  assignedUserId: string | null | undefined,
): boolean {
  if (role === OWNER_ROLE) return true;
  return role === STAFF_ROLE && userId === assignedUserId && userId != null;
}

/** Returns the Prisma `where` filter for a user's lead visibility scope. */
export function leadVisibilityWhere(
  role: string | undefined,
  userId: string | undefined,
): Record<string, unknown> {
  if (role === OWNER_ROLE) return {};
  if (role === STAFF_ROLE && userId) return { assignedUserId: userId };
  // Non-authenticated or unknown role: no leads visible.
  return { id: null as string | null };
}
