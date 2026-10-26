import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import markNotificationReadAction from "./actions";
import { NotificationBell } from "@/components/admin/NotificationBell";

export const dynamic = "force-dynamic";

/**
 * In-app notification area (D-034). Every signed-in CRM user sees THEIR OWN
 * notifications only — the query is scoped by userId server-side, so no
 * other user's lead details can leak here. Private lead data is shown only
 * to recipients who are authorized on the lead (Owner or current assignee —
 * which is exactly who the notification was addressed to at creation).
 */
export default async function NotificationsPage() {
  const user = await requireCrmUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      leadId: true,
      type: true,
      title: true,
      body: true,
      readAt: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
          <p className="text-sm text-neutral-500">
            New assignments and referral arrivals addressed to you.
          </p>
        </div>
        <NotificationBell />
      </div>

      {notifications.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="font-semibold text-neutral-700">Nothing yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Referral-driven lead assignments addressed to you will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-2xl border p-5 shadow-sm shadow-neutral-900/5 ${
                notification.readAt
                  ? "border-neutral-200 bg-white"
                  : "border-brand-500/30 bg-brand-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-900">
                    {notification.title}
                  </p>
                  {notification.body ? (
                    <p className="mt-1 text-sm text-neutral-600">
                      {notification.body}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-neutral-400">
                    {notification.createdAt.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {notification.type === "contact_transfer_assignment" ? (
                    <Link href="/admin/my-contacts?view=queue" className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100">Review incoming transfers</Link>
                  ) : null}
                  {notification.leadId ? (
                    <Link
                      href={`/admin/leads/${notification.leadId}`}
                      className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
                    >
                      View contact
                    </Link>
                  ) : null}
                  {!notification.readAt ? (
                    <form action={markNotificationReadAction}>
                      <input
                        type="hidden"
                        name="notificationId"
                        value={notification.id}
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
                      >
                        Mark read
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-neutral-400">Read</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
