import Link from "next/link";
import {
  getUnreadNotificationCount,
} from "@/lib/notifications";
import { requireCrmUser } from "@/server/auth/requireCrmUser";

/**
 * Read-only server component: red badge with the signed-in user's unread
 * notification count, linking to /admin/notifications.
 * Fail-safe: any error renders a silent, count-less bell (never breaks the
 * admin shell).
 */
export async function NotificationBell() {
  let unread = 0;
  try {
    const user = await requireCrmUser();
    unread = await getUnreadNotificationCount(user.id);
  } catch {
    unread = 0;
  }

  return (
    <Link
      href="/admin/notifications"
      className="relative inline-flex items-center rounded-full border border-neutral-200 bg-white p-2 text-neutral-600 transition-colors hover:bg-neutral-50"
      aria-label={
        unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
      }
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
