import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requireCrmUser } from "@/server/auth/requireCrmUser";
import { getCrmUsers } from "@/app/admin/(protected)/actions";
import { AssignmentForm, type StaffUser } from "@/components/admin/AssignmentForm";
import { LeadStatusForm } from "@/components/admin/LeadStatusForm";
import { FollowUpForm } from "@/components/admin/FollowUpForm";
import { CompleteFollowUpButton } from "@/components/admin/CompleteFollowUpButton";
import { followUpLabel, formatCrmStatus } from "@/lib/crm-phase2";
import { MeetingForm } from "@/components/admin/MeetingForm";
import { MeetingUpdateForm } from "@/components/admin/MeetingUpdateForm";
import { CommunicationPanel } from "@/components/admin/CommunicationPanel";
import {
  buildTelLink,
  buildWhatsAppLink,
  isClientEmailSendingEnabled,
  normalizeToE164,
} from "@/lib/communications";

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

  const user = await requireCrmUser();

  // Phase A: ownership-scoped lookup.
  // Owner sees all leads. Staff sees only their assigned leads.
  const where =
    user.role === "admin" ? { id } : { id, assignedUserId: user.id };

  const lead = await prisma.lead.findUnique({
    where,
    include: {
      meetings: { orderBy: { scheduledAt: "desc" } },
      followUps: { orderBy: { createdAt: "desc" } },
      events: {
        orderBy: { createdAt: "desc" }, take: 25,
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!lead) notFound();

  // Category-only prospect interests are stored as audit events, not
  // misleading synthetic ProductInterest rows. This scoped read happens only
  // after the existing ownership-authorized lead lookup succeeds.
  const categoryInterest = await prisma.leadEvent.findFirst({
    where: { leadId: lead.id, type: "product_category_interest" },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  const categoryMeta =
    categoryInterest?.metadata &&
    typeof categoryInterest.metadata === "object" &&
    !Array.isArray(categoryInterest.metadata)
      ? categoryInterest.metadata
      : null;
  const categoryName =
    categoryMeta && typeof categoryMeta.categoryName === "string"
      ? categoryMeta.categoryName
      : null;
  const preferredMeeting =
    categoryMeta && typeof categoryMeta.meetingPreference === "string"
      ? categoryMeta.meetingPreference.replaceAll("_", " ")
      : null;

  const isOwner = user.role === "admin";

  // D-034 Phase 4 — communications (Owner + current assignee only, which the
  // ownership-scoped `where` above already guarantees).
  const e164 = normalizeToE164(lead.phone);
  const whatsappHref = e164
    ? buildWhatsAppLink(
        e164,
        `Hello ${lead.firstName}, this is the NEOLIFE office team. We received your interest and would love to answer your questions.`,
      )
    : null;
  const telHref = e164 ? buildTelLink(e164) : null;
  const emailSendingEnabled = isClientEmailSendingEnabled();

  // Phase B: Owner-only data for the assignment UI.
  const staffUsers = isOwner ? (await getCrmUsers()) as StaffUser[] : [];
  let currentAssignee: StaffUser | null = null;
  if (isOwner && lead.assignedUserId) {
    const assigned = await prisma.user.findUnique({
      where: { id: lead.assignedUserId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (assigned) currentAssignee = assigned as StaffUser;
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/leads"
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          ← Back to contacts
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
              {categoryName ? <Field label="Product category" value={categoryName} /> : null}
              {preferredMeeting ? <Field label="Preferred meeting format" value={preferredMeeting} /> : null}
              <Field label="Created" value={lead.createdAt.toLocaleString()} />
              <Field
                label="Consent"
                value={
                  lead.consent
                    ? `Yes · ${lead.consentAt?.toLocaleString() ?? "recorded"}`
                    : "No"
                }
              />
              {isOwner ? (
                <Field
                  label="Assigned to"
                  value={
                    currentAssignee
                      ? `${currentAssignee.name} (${currentAssignee.email})`
                      : lead.assignedUserId === user.id
                        ? "You"
                        : "Unassigned"
                  }
                />
              ) : null}
              {/* D-034: original referrer is visibly distinct from the current
                  assignee — reassignment never rewrites it. Shows the
                  visitor's self-reported spelling for manual attribution when
                  available, otherwise the creation-time APPROVED public
                  referrer snapshot (code-based attribution), Task #027. */}
              <Field
                label="Referred by (original)"
                value={
                  lead.referredByName || lead.referredBySnapshot
                    ? `${
                        lead.referredByName ?? lead.referredBySnapshot
                      }${
                        lead.referralMethod
                          ? ` · via ${
                              lead.referralMethod === "link"
                                ? "referral link"
                                : "manual entry"
                            }`
                          : ""
                      }`
                    : null
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
                    {meeting.notes ? (
                      <p className="mt-1 text-sm text-neutral-600">{meeting.notes}</p>
                    ) : null}
                    <MeetingUpdateForm
                      meetingId={meeting.id}
                      currentStatus={meeting.status}
                      outcome={meeting.outcome}
                      notes={meeting.notes}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <MeetingForm leadId={lead.id} />
            </div>
          </section>

          <CommunicationPanel
            leadId={lead.id}
            leadName={lead.firstName}
            phoneRaw={lead.phone}
            emailOnRecord={lead.email}
            whatasppEnabled={Boolean(whatsappHref)}
            emailEnabled={emailSendingEnabled}
            whatsappHref={whatsappHref}
            telHref={telHref}
          />

          <section className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              Follow-up
            </h2>
            {lead.followUps.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">No follow-up notes or tasks yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {lead.followUps.map((followUp) => {
                  const label = followUpLabel(followUp.dueAt, followUp.completedAt, new Date());
                  return <li key={followUp.id} className="rounded-xl border border-neutral-100 p-4 text-sm text-neutral-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-neutral-500">Added {followUp.createdAt.toLocaleString()}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${label === "Overdue" ? "bg-rose-50 text-rose-700" : label === "Completed" ? "bg-emerald-50 text-emerald-700" : "bg-mulberry-50 text-mulberry-800"}`}>{label}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words">{followUp.note}</p>
                    {followUp.dueAt && <p className="mt-2 text-xs text-neutral-500">Due {followUp.dueAt.toLocaleString()}</p>}
                    {followUp.completedAt && <p className="mt-1 text-xs text-emerald-700">Completed {followUp.completedAt.toLocaleString()}</p>}
                    {followUp.dueAt && !followUp.completedAt && <div className="mt-3"><CompleteFollowUpButton id={followUp.id} /></div>}
                  </li>;
                })}
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

            {/* Phase B: Owner-only assignment controls */}
            {isOwner ? (
              <div className="mt-6 border-t border-neutral-100 pt-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
                  Contact assignment
                </h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Staff see only leads assigned to them. The Owner manages assignment.
                </p>
                <div className="mt-3">
                  <AssignmentForm
                    leadId={lead.id}
                    currentAssignee={currentAssignee}
                    staffUsers={staffUsers}
                  />
                </div>
              </div>
            ) : null}
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
                  <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-50 py-1 last:border-0">
                    <span className="font-medium text-neutral-700">
                      {formatCrmStatus(event.type)}
                      {event.user ? <span className="ml-2 font-normal text-neutral-500">by {event.user.name}</span> : null}
                    </span>
                    <span className="text-xs text-neutral-400">{event.createdAt.toLocaleString()}</span>
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
