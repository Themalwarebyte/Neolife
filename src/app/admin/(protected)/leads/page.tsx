import Link from "next/link";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

const INTEREST_LABELS: Record<string, string> = {
  BUSINESS: "Business",
  PRODUCT: "Product",
  BOTH: "Business + Product",
  UNSURE: "Unsure",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      city: true,
      interestType: true,
      status: true,
      createdAt: true,
      utmSource: true,
      utmCampaign: true,
      landingPage: true,
      _count: { select: { meetings: true, followUps: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Leads</h1>
          <p className="text-sm text-neutral-500">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="font-semibold text-neutral-700">No leads yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            New registrations will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Interest</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Activity</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="font-semibold text-neutral-900 hover:text-brand-700"
                      >
                        {lead.firstName} {lead.lastName ?? ""}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      <div>{lead.phone}</div>
                      {lead.email ? (
                        <div className="text-neutral-400">{lead.email}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {INTEREST_LABELS[lead.interestType] ?? lead.interestType}
                      {lead.city ? (
                        <div className="text-neutral-400">{lead.city}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={lead.status} />
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {lead.utmSource ?? "—"}
                      {lead.utmCampaign ? (
                        <div className="text-xs text-neutral-400">
                          {lead.utmCampaign}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {lead.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {lead._count.meetings > 0
                        ? `${lead._count.meetings} meeting(s)`
                        : "—"}
                      {lead._count.followUps > 0
                        ? ` · ${lead._count.followUps} note(s)`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="divide-y divide-neutral-100 md:hidden">
            {leads.map((lead) => (
              <li key={lead.id} className="p-4">
                <Link
                  href={`/admin/leads/${lead.id}`}
                  className="font-semibold text-neutral-900"
                >
                  {lead.firstName} {lead.lastName ?? ""}
                </Link>
                <div className="mt-1 text-sm text-neutral-600">{lead.phone}</div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusPill status={lead.status} />
                  <span className="text-xs text-neutral-500">
                    {lead.utmSource ?? "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
