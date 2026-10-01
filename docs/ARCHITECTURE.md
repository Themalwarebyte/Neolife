# NEOLIFE — Architecture

## Overview

NEOLIFE is a Next.js 16 (App Router) + React 19 + TypeScript application backed by
PostgreSQL 16 via Prisma 7. Authentication is handled by Better Auth. The
application serves two audiences:

1. **Public** — landing page, product catalogue, lead capture funnel.
2. **Office/CRM** — authenticated admin (Owner) and Staff (Colleague) interfaces.

## Authentication

- **Framework:** Better Auth 1.7.2 with Prisma adapter (`@better-auth/prisma-adapter`).
- **Provider:** Email/password (`better-auth` `emailAndPassword.enabled = true`).
- **Session:** Cookie-based; verified server-side on each request.
- **User model:** `User` table with `id`, `name`, `email`, `role`.
  - `role` field: `"admin"` (Owner) or `"staff"` (Colleague). Default: `"staff"`.
  - `input: false` in Better Auth config — clients cannot self-assign role.
  - No public sign-up route; accounts are provisioned via seed scripts or direct DB access.

## Authorization

### Role boundary

| Role | Label | CRM access | Lead assignment | Lead visibility |
|---|---|---|---|---|
| `admin` | Owner | Full | Can assign/reassign/unassign | All leads |
| `staff` | Colleague | Scoped | Cannot assign/reassign/unassign | Only assigned leads |

### Auth modules

- **`src/server/auth/requireAdmin.ts`** — Original admin-only guard (Phase 1). Used by legacy code paths.
- **`src/server/auth/requireCrmUser.ts`** — (Phase A) Role-aware module:
  - `getCrmUser()` — returns the authenticated CRM user or null.
  - `requireCrmUser()` — returns the user or redirects to `/admin/login`.
  - `requireAdmin()` — returns the user or redirects (enforces `role === "admin"`).
  - `isAdminSession()` — boolean check for admin role.

### Ownership enforcement (Phase A + Phase B)

- **Lead visibility** is enforced at the data layer (per-query `where` clause):
  - Owner (`role === "admin"`): no filter — sees all leads.
  - Staff (`role === "staff"`): `{ assignedUserId: userId }` — sees only assigned leads.
  - Staff accessing an unassigned or another user's lead: **404** (record not found in their scope).
- **Lead assignment** is enforced in the `assignLead` Server Action:
  - Calls `requireAdmin()` first — non-admins are rejected before any DB mutation.
  - Target user is validated: must exist and have `role === "staff"`.
  - `assignedUserId` is never trusted from client input alone — the action re-validates the target user server-side.
- **Pure helpers** in `src/lib/assignment.ts` (`canAssignLeads`, `isAssignableRole`, `canViewLead`, `leadVisibilityWhere`) encapsulate the authorization policy for testability.

## Data model (CRM)

### Lead

```prisma
model Lead {
  id              String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  firstName       String
  lastName        String?
  phone           String
  email           String?
  city            String?
  interestType    InterestType @default(UNSURE)
  qualificationNotes String?
  consent         Boolean
  consentAt       DateTime?
  status          LeadStatus   @default(NEW_LEAD)
  utmSource       String?
  utmMedium       String?
  utmCampaign     String?
  utmContent      String?
  utmTerm         String?
  landingPage     String?
  firstTouchSource String?
  assignedUserId  String?      @db.Uuid  // Phase A
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  events           LeadEvent[]
  meetings         Meeting[]
  followUps        FollowUp[]
  productInterests ProductInterest[]
  assignedUser     User?        @relation("user_assigned_leads", fields: [assignedUserId], references: [id], onDelete: SetNull)

  @@index([status])
  @@index([createdAt])
  @@index([utmCampaign])
  @@index([assignedUserId])
  @@index([assignedUserId, status])
}
```

### User

```prisma
model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  role          String    @default("staff")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions      Session[]
  accounts      Account[]
  assignedLeads Lead[]    @relation("user_assigned_leads")
}
```

### LeadEvent (audit trail)

```prisma
model LeadEvent {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  leadId    String?  @db.Uuid
  type      String   // event type (lead_assigned, status_changed, etc.) — kept as String, not enum (D-028)
  metadata  Json?    // structured metadata (e.g. { by, from, to } for assignment)
  userId    String?  // canonical audit actor — the authenticated CRM user who performed the action (D-028)
  createdAt DateTime @default(now())
}
```

**Audit event types:** `status_changed`, `follow_up_added`, `meeting_scheduled`,
`meeting_status_changed`, `lead_assigned`, `lead_unassigned`.

### FunnelEvent (first-party funnel tracking)

```prisma
model FunnelEvent {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  type      String   // approved event type (D-029)
  leadId    String?  @db.Uuid  // FK to Lead, ON DELETE SET NULL
  attribution Json?   // validated first-party UTM attribution
  deviceId  String?   // anonymous client-generated UUID (no IP/userAgent/PII — D-031)
  metadata  Json?     // sanitized event-specific metadata
  createdAt DateTime @default(now())

  @@index([type])
  @@index([leadId])
  @@index([createdAt])
  @@index([deviceId])
  @@index([deviceId, createdAt])
}
```

**Funnel event types:** `visitor_landing`, `lead_created`, `lead_qualified`, `registration_start`, `registration_complete`.

- `visitor_landing` — recorded by the client via `/api/funnel` POST (client-allowed). Fires on landing page load with UTM attribution, 10-min per-device debounce.
- `registration_start` — recorded by the client via `/api/funnel` POST (client-allowed). Fires when the RegistrationForm is displayed on the qualify page.
- `lead_created` — recorded server-side in `submitLeadAction` upon successful lead creation.
- `lead_qualified` — recorded server-side in `qualifyLeadAction` upon successful qualification.
- `registration_complete` — recorded server-side in `registerInterestAction` upon successful `ProductInterest` persistence (transactional with the create).
- **Funnel flow:** `visitor_landing` → `lead_created` → `lead_qualified` → `registration_start` → `registration_complete` (where applicable).
- **D-029:** FunnelEvent is separate from LeadEvent (marketing/analytics vs. CRM audit trail).
- **D-031:** FunnelEvent stores NO `ipAddress`, `userAgent`, `firstName`, `phone`, or `userId` — only anonymous `deviceId` and validated attribution.

### QualificationToken (D-030)

```prisma
model QualificationToken {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  leadId    String   @db.Uuid  // FK to Lead, ON DELETE CASCADE
  nonce     String   @unique   // random UUID for DB-backed single-use enforcement
  expiresAt DateTime
  consumedAt DateTime?
  createdAt DateTime @default(now())

  @@index([leadId])
  @@index([expiresAt])
  @@index([consumedAt])
}
```

- HMAC-SHA256 signed token format: `<leadId>.<expiresAt>.<nonce>.<signature>`.
- Single-use enforced atomically via DB `expiredAt > NOW() AND consumedAt IS NULL` check-and-set.
- No Lead PII embedded in the token.

## Request flow

### Public lead capture

```
Visitor → Landing Page (UTM capture in localStorage)
    → FunnelTracker: visitor_landing event (client → /api/funnel)
    → /register-interest (form)
    → src/app/actions/lead.ts (Server Action)
      → parseLeadInput (Zod validation)
      → parseAttributionPayload (charset/length validation, XSS-safe)
      → persistLead (Prisma → Lead table)
      → FunnelEvent: "lead_created" (server-side)
      → generateQualificationToken (D-030)
      → Return qualificationToken to client
    → Success page with "Continue to Qualification" link
```

### Public qualification flow (D-030)

```
Prospect → /register-interest/qualify?token=<token>
    → QualificationForm (client) — structural token check for UX only
    → src/app/actions/qualify.ts (Server Action)
      → consumeQualificationToken (atomic: verify HMAC signature + DB nonce + expiration)
      → Update Lead status → QUALIFIED
      → FunnelEvent: "lead_qualified" (server-side)
      → Revalidate CRM pages
```

### Office CRM

```
Owner/Staff → /admin (redirect: authenticated → /admin/leads, else → /admin/login)
          → /admin/leads (ownership-scoped list)
          → /admin/leads/[id] (ownership-scoped detail)
            → LeadStatusForm → updateLeadStatus (status_changed event)
            → FollowUpForm → addFollowUp (follow_up_added event)
            → MeetingForm → scheduleMeeting (meeting_scheduled event)
            → MeetingUpdateForm → updateMeeting (meeting_status_changed event)
            → AssignmentForm → assignLead (lead_assigned / lead_unassigned event, Owner-only)
```

## Deployment architecture

- **Local dev:** Docker Compose (`docker-compose.yml`) — PostgreSQL 16 on port 5433.
- **Production:** Docker standalone + Compose (`deploy/compose.yaml`) — isolated `neolife` project/network, Caddy gateway, Cloudflare Tunnel.
- **Migration strategy:** `prisma migrate deploy` in the Docker entrypoint (see `docs/DEPLOYMENT.md`).
- **Secrets:** Root-owned env file injected as container environment variables; never committed.

## Testing

- **Unit/pure:** Vitest (`pnpm test`) — no DB required.
- **Integration:** Vitest with DB — `tests/*-persistence.test.ts` and `tests/qualification.test.ts`, `tests/funnel-events.test.ts` (require `docker compose up -d`).
- **DB integration:** `scripts/test-db-integration.js` — 30 tests validating FunnelEvent schema (D-031 no-PII), QualificationToken schema, single-use consumption, replay prevention, durability, and qualification workflow. Run from WSL (Windows node has WSL PostgreSQL networking issues).
- **E2E:** Playwright with system Chrome (`pnpm exec playwright test`).
