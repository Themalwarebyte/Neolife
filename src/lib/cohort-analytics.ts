/**
 * Pure, PII-free cohort analytics for the CRM.
 * Counts unique leads that progressed after being created in a reporting window.
 * These metrics describe recorded first-party CRM events, not revenue or official distributor registrations.
 */
export type CohortLead = {
  id: string;
  firstTouchSource: string | null;
  utmCampaign: string | null;
  status: string;
};

export type CohortEvent = {
  leadId: string | null;
  type: string;
};

export type ScheduledFollowUpObservation = {
  completedAt: Date | null;
};

export type CohortMetrics = {
  leadsCaptured: number;
  qualifiedLeads: number;
  productInterestLeads: number;
  currentlyConverted: number;
  qualifiedRate: number;
  productInterestRate: number;
  convertedRate: number;
};

export type CohortSourceRow = CohortMetrics & {
  source: string;
  campaign: string;
};

export type CohortAnalyticsSummary = {
  overall: CohortMetrics;
  sourceRows: CohortSourceRow[];
  followUps: {
    scheduledDuringWindow: number;
    completedScheduledTasks: number;
    completionRate: number;
  };
};

function rate(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

export function formatCohortRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

function metricsForLeads(
  leads: readonly CohortLead[],
  qualifiedIds: ReadonlySet<string>,
  productInterestIds: ReadonlySet<string>,
): CohortMetrics {
  const ids = new Set(leads.map((lead) => lead.id));
  const qualifiedLeads = [...qualifiedIds].filter((id) => ids.has(id)).length;
  const productInterestLeads = [...productInterestIds].filter((id) => ids.has(id)).length;
  const currentlyConverted = leads.filter((lead) => lead.status === "CONVERTED").length;
  const leadsCaptured = leads.length;
  return {
    leadsCaptured,
    qualifiedLeads,
    productInterestLeads,
    currentlyConverted,
    qualifiedRate: rate(qualifiedLeads, leadsCaptured),
    productInterestRate: rate(productInterestLeads, leadsCaptured),
    convertedRate: rate(currentlyConverted, leadsCaptured),
  };
}

/**
 * Builds cohort metrics from leads created within a selected window and their recorded
 * progression events up to report time. Repeated events are counted once per lead and stage.
 */
export function buildCohortAnalytics(
  leads: readonly CohortLead[],
  events: readonly CohortEvent[],
  scheduledFollowUps: readonly ScheduledFollowUpObservation[],
): CohortAnalyticsSummary {
  const leadIds = new Set(leads.map((lead) => lead.id));
  const qualifiedIds = new Set<string>();
  const productInterestIds = new Set<string>();

  for (const event of events) {
    if (!event.leadId || !leadIds.has(event.leadId)) continue;
    if (event.type === "lead_qualified") qualifiedIds.add(event.leadId);
    if (event.type === "registration_complete") productInterestIds.add(event.leadId);
  }

  const groups = new Map<string, { source: string; campaign: string; leads: CohortLead[] }>();
  for (const lead of leads) {
    const source = lead.firstTouchSource?.trim() || "Direct / unknown";
    const campaign = lead.utmCampaign?.trim() || "No campaign captured";
    const key = JSON.stringify([source, campaign]);
    const group = groups.get(key) ?? { source, campaign, leads: [] };
    group.leads.push(lead);
    groups.set(key, group);
  }

  const sourceRows = [...groups.values()]
    .map((group) => ({
      source: group.source,
      campaign: group.campaign,
      ...metricsForLeads(group.leads, qualifiedIds, productInterestIds),
    }))
    .sort((a, b) => b.leadsCaptured - a.leadsCaptured || a.source.localeCompare(b.source) || a.campaign.localeCompare(b.campaign));

  const completedScheduledTasks = scheduledFollowUps.filter((task) => task.completedAt !== null).length;
  return {
    overall: metricsForLeads(leads, qualifiedIds, productInterestIds),
    sourceRows,
    followUps: {
      scheduledDuringWindow: scheduledFollowUps.length,
      completedScheduledTasks,
      completionRate: rate(completedScheduledTasks, scheduledFollowUps.length),
    },
  };
}

/** Prefix formula-like text so spreadsheet programs do not evaluate untrusted CSV cells. */
export function sanitizeCsvText(value: string): string {
  // Preserve protection for leading control characters without a control-character regex.
  let firstNonControl = 0;
  while (firstNonControl < value.length && value.charCodeAt(firstNonControl) <= 0x20) {
    firstNonControl += 1;
  }
  const first = value[firstNonControl];
  return first === "=" || first === "+" || first === "-" || first === "@" ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  const text = typeof value === "string" ? sanitizeCsvText(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Generates an aggregate-only CSV. It never includes contact names, phone numbers, emails, or IDs. */
export function buildCohortCsv(
  summary: CohortAnalyticsSummary,
  range: string,
  generatedAt: Date = new Date(),
): string {
  const rows: Array<Array<string | number>> = [
    ["Report", "NEOLIFE CRM cohort progression"],
    ["Reporting window", range],
    ["Generated at (UTC)", generatedAt.toISOString()],
    [],
    [
      "First-touch source", "Campaign", "Leads captured", "Qualified unique leads", "Qualified rate",
      "Product-interest unique leads", "Product-interest rate", "Currently converted", "Current converted rate",
    ],
  ];

  for (const row of summary.sourceRows) {
    rows.push([
      row.source,
      row.campaign,
      row.leadsCaptured,
      row.qualifiedLeads,
      formatCohortRate(row.qualifiedRate),
      row.productInterestLeads,
      formatCohortRate(row.productInterestRate),
      row.currentlyConverted,
      formatCohortRate(row.convertedRate),
    ]);
  }

  const overall = summary.overall;
  rows.push([
    "ALL SOURCES",
    "",
    overall.leadsCaptured,
    overall.qualifiedLeads,
    formatCohortRate(overall.qualifiedRate),
    overall.productInterestLeads,
    formatCohortRate(overall.productInterestRate),
    overall.currentlyConverted,
    formatCohortRate(overall.convertedRate),
  ]);
  rows.push([]);
  rows.push(["Follow-up performance", "Tasks scheduled during the selected window", summary.followUps.scheduledDuringWindow]);
  rows.push(["Follow-up performance", "Those scheduled tasks currently completed", summary.followUps.completedScheduledTasks]);
  rows.push(["Follow-up performance", "Completion rate", formatCohortRate(summary.followUps.completionRate)]);
  rows.push([]);
  rows.push(["Definitions", "Cohort includes leads created in the selected window; recorded progression events are counted through report time."]);
  rows.push(["Definitions", "Product-interest submission is not official distributor registration and does not represent revenue."]);

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
