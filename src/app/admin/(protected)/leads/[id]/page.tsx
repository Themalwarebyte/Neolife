import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { LeadStatusForm } from "@/components/admin/LeadStatusForm";
import { FollowUpForm } from "@/components/admin/FollowUpForm";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-neutral-800">
        {value && value.length > 0 ? value : "—"}
      </dd>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      meetings: { orderBy: { scheduledAt: "desc" } },
      followUps: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 25 },
    },
  });
  if (!lead) notFound();

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/leads"
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          ← Back to leads
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">
          {lead.firstName} {lead.lastName ?? ""}
        </h1>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-700">
          {lead.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              Contact
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Phone" value={lead.phone} />
              <Field label="Email" value={lead.email} />
              <Field label="City / area" value={lead.city} />
              <Field label="Interest" value={lead.interestType.replaceAll("_", " ")} />
              <Field label="Created" value={lead.createdAt.toLocaleString()} />
              <Field
                label="Consent"
                value={
                  lead.consent
                    ? `Yes · ${lead.consentAt?.toLocaleString() ?? "recorded"}`
                    : "No"
                }
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              Attribution
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="First-touch source" value={lead.firstTouchSource} />
              <Field label="UTM source" value={lead.utmSource} />
              <Field label="UTM medium" value={lead.utmMedium} />
              <Field label="UTM campaign" value={lead.utmCampaign} />
              <Field label="UTM content" value={lead.utmContent} />
              <Field label="UTM term" value={lead.utmTerm} />
              <Field label="Landing page" value={lead.landingPage} />
            </dl>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              Meetings
            </h2>
            {lead.meetings.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">No meetings recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {lead.meetings.map((meeting) => (
                  <li key={meeting.id} className="rounded-xl border border-neutral-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-neutral-800">
                        {meeting.scheduledAt.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        {meeting.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    {meeting.outcome ? (
                      <p className="mt-1 text-sm text-neutral-600">
                        Outcome: {meeting.outcome}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              Follow-up
            </h2>
            {lead.followUps.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">No follow-up notes yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {lead.followUps.map((followUp) => (
                  <li key={followUp.id} className="rounded-xl border border-neutral-100 p-4 text-sm text-neutral-700">
                    <div className="text-xs text-neutral-400">
                      {followUp.createdAt.toLocaleString()}
                    </div>
                    {followUp.note}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <FollowUpForm leadId={lead.id} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              Manage
            </h2>
            <div className="mt-4">
              <LeadStatusForm leadId={lead.id} currentStatus={lead.status} />
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              Recent events
            </h2>
            {lead.events.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">No events yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {lead.events.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-2">
                    <span className="font-medium text-neutral-700">
                      {event.type.replaceAll("_", " ")}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {event.createdAt.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
