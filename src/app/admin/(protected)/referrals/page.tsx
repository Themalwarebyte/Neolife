import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { requireAdmin } from "@/server/auth/requireCrmUser";
import { SignOutButton } from "@/components/admin/SignOutButton";
import {
  generateStaffReferralLink,
  revokeStaffReferralLink,
  type CrmActionResult,
} from "@/app/admin/(protected)/actions";
import { ReferralLinkRow } from "@/components/admin/ReferralLinkRow";
import { NotificationBell } from "@/components/admin/NotificationBell";

export const dynamic = "force-dynamic";

/**
 * Owner-only referral-link management (D-034).
 * Shows every Staff account with its referral code status; the Owner can
 * generate / rotate / revoke links. Only active links resolve on the public
 * /business page — anything else fails safely to the Owner pool.
 */
export default async function ReferralsPage() {
  await requireAdmin();

  const staff = await prisma.user.findMany({
    where: { role: "staff" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      referralCode: {
        select: {
          code: true,
          isActive: true,
          revokedAt: true,
          publicName: true,
          createdAt: true,
        },
      },
    },
  });

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://neolife.ooflowdesk.com";

  async function generate(prevState: CrmActionResult | null, formData: FormData) {
    "use server";
    return generateStaffReferralLink(formData);
  }
  async function revoke(prevState: CrmActionResult | null, formData: FormData) {
    "use server";
    return revokeStaffReferralLink(formData);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Referral links</h1>
          <p className="text-sm text-neutral-500">
            Each active staff member has one shareable link; rotate or revoke it
            any time.
          </p>
        </div>
        <NotificationBell />
      </div>

      <p className="mt-3 max-w-3xl rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-xs text-neutral-500">
        A lead captured through a valid, active referral link is automatically
        assigned to that staff member at creation (D-034). Revoked, inactive or
        unknown links never block capture: the lead simply stays unassigned in
        your pool. Original referral attribution is permanent — reassignment
        later does not change who referred the contact.
      </p>

      <ul className="mt-6 space-y-4">
        {staff.map((member) => (
          <li
            key={member.id}
            className="rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-900/5"
          >
            <ReferralLinkRow
              member={{
                id: member.id,
                name: member.name,
                email: member.email,
                isActive: member.isActive,
              }}
              referral={member.referralCode}
              origin={origin}
              generateReferral={generate}
              revokeReferral={revoke}
            />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm">
        <Link href="/admin/leads" className="font-semibold text-brand-700 hover:underline">
          ← Back to contacts
        </Link>
      </p>
      <SignOutButton />
    </div>
  );
}
