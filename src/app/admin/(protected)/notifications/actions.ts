"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Marks one of the CURRENT USER's notifications as read.
 * The userId scoping in the where clause is the authorization: a user can
 * never mark (or even touch) someone else's notification.
 */
export default async function markNotificationReadAction(
  formData: FormData,
): Promise<void> {
  const user = await requireCrmUser();
  const id = String(formData.get("notificationId") ?? "");
  if (!UUID.test(id)) return;

  try {
    await prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/admin/notifications");
  } catch {
    // Non-critical UI state — never fail the page over a read-flag.
  }
}
