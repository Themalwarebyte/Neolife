import { prisma } from "@/server/db/prisma";

/**
 * In-app notifications (D-034, Phase 3).
 *
 * - Per-recipient rows in the Notification table, deduplicated by a unique
 *   `dedupKey` so retries never create duplicates.
 * - Notification failures must NEVER discard a successfully captured lead:
 *   callers that cannot fail the main flow use `tryNewNotification`.
 */

export const NOTIFICATION_TYPES = ["lead_assigned", "system"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NewNotificationInput = {
  userId: string;
  leadId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  dedupKey: string;
};

/**
 * Deduped write. Returns the notification when created; null when the
 * dedupKey already exists (retry / duplicate) or on failure.
 */
export async function tryNewNotification(
  input: NewNotificationInput,
): Promise<boolean> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        leadId: input.leadId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        dedupKey: input.dedupKey,
      },
    });
    return true;
  } catch {
    // Unique-constraint violation (already notified) or transient failure:
    // either way the caller's main flow must continue.
    return false;
  }
}

/** Unread count for the admin navigation badge. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    return await prisma.notification.count({
      where: { userId, readAt: null },
    });
  } catch {
    return 0;
  }
}
