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
- **User model:** `User` table with `id`, `name`, `email`, `role`, `mustChangePassword`, `isActive`.
  - `role` field: `"admin"` (Owner) or `"staff"` (Colleague). Default: `"staff"`.
  - `input: false` in Better Auth config — clients cannot self-assign role.
  - `mustChangePassword Boolean @default(false)` — forces a password change on next login.
  - `isActive Boolean @default(true)` — deactivated accounts cannot authenticate.
  - Both are registered as Better Auth `additionalFields`: `mustChangePassword` with
    `input: true` (server sets it), `isActive` with **`input: false`** so a client can
    never set its own activation state.
  - No public sign-up route; accounts are provisioned via `scripts/seed-admin.ts`,
    `scripts/seed-staff.ts`, or the Owner-only `/admin/users` page.

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
- **Pure helpers** in `src/lib/user-management.ts` encapsulate the user-management input policy (name, email, temporary-password strength) for testability.

### Admin user management (P-2)

Owner-only account lifecycle: create Staff users, force a password change on first
login, and activate/deactivate accounts.

**Routes**

| Route | Access | Purpose |
|---|---|---|
| `/admin/users` | Owner only (`requireAdmin`) | Create Staff users; list all users; activate/deactivate |
| `/admin/change-password` | Any authenticated user | Complete a forced password change |
| `/admin/leads`, `/admin/leads/[id]` | Owner + Staff | Ownership-scoped CRM (unchanged) |

> `/admin/change-password` is deliberately **outside** the `(protected)` route group.
> The protected layout redirects users with `mustChangePassword: true` to this
> route; if the page were inside the group the redirect would loop.

**Server actions** (`src/app/admin/(protected)/actions.ts`)

| Action | Guard | Behaviour |
|---|---|---|
| `createCrmUser` | `requireAdmin()` | Creates the account via Better Auth `signUpEmail` (password hashed, never plaintext), then sets `role: "staff"` and `mustChangePassword: true` server-side. Rejects duplicate emails. |
| `toggleUserActive` | `requireAdmin()` | Flips `isActive`. Refuses to deactivate `admin` accounts and refuses self-deactivation. |
| `changePasswordAction` | `requireCrmUser()` + `mustChangePassword` | Calls Better Auth `changePassword`, then clears `mustChangePassword`. |

**Authorization controls**

- **Staff cannot create users or change roles.** `createCrmUser` calls
  `requireAdmin()` before any mutation. The `role` field is `input: false` in the
  Better Auth config, so role cannot be supplied by a client; new Staff accounts are
  hardcoded `role: "staff"` via Prisma after sign-up.
- **Inactive accounts are fully locked out.** `getCrmUser()` returns `null` when
  `isActive` is false, so `requireCrmUser()` treats them as unauthenticated and
  redirects to `/admin/login`. Every protected route is affected, not just CRM reads.
- **Owner accounts cannot be deactivated**, and the Owner cannot deactivate their own
  account — both enforced in `toggleUserActive` after `requireAdmin()`.
- **Forced password change cannot be bypassed.** The `(protected)` layout redirects
  any user with `mustChangePassword: true` to `/admin/change-password`, so direct
  navigation to CRM routes is intercepted. `mustChangePassword` is cleared only after
  a successful password change.
- **Owner-only pages reject Staff.** Navigating to `/admin/users` as Staff redirects
  away, since the page calls `requireAdmin()`.

**Provenance:** `prisma/migrations/20260919000000_add_user_management_fields/`,
`src/lib/auth.ts`, `src/lib/user-management.ts`, `src/server/auth/requireCrmUser.ts`,
`src/app/admin/(protected)/users/`, `src/app/admin/change-password/`,
`src/app/admin/(protected)/actions.ts`, `scripts/seed-staff.ts`.

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
  mustChangePassword Boolean @default(false)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions Session[]
  accounts Account[]
  assignedLeads Lead[] @relation("user_assigned_leads")
  events LeadEvent[]
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
Visitor → /admin (redirect: authenticated → /admin/leads, else → /admin/login)
Owner   → /admin/users (Owner only)
          → create-user-form → createCrmUser   (Staff account + mustChangePassword)
          → toggleUserActive                   (activate / deactivate Staff)
Owner/Staff → /admin/leads (ownership-scoped list)
          → /admin/leads/[id] (ownership-scoped detail)
            → LeadStatusForm → updateLeadStatus (status_changed event)
            → FollowUpForm → addFollowUp (follow_up_added event)
            → MeetingForm → scheduleMeeting (meeting_scheduled event)
            → MeetingUpdateForm → updateMeeting (meeting_status_changed event)
            → AssignmentForm → assignLead (lead_assigned / lead_unassigned event, Owner-only)

Any user with mustChangePassword = true
       → (protected) layout intercepts → /admin/change-password
         → changePasswordAction (Better Auth changePassword, then clears the flag)
       → /admin/leads
```

## Deployment architecture

- **Local dev:** Docker Compose (`docker-compose.yml`) — PostgreSQL 16 on port 5433.
- **Production:** 🟩 **LIVE** at `https://neolife.ooflowdesk.com`. Docker standalone +
  Compose (`compose.production.yaml`, mirrored to the server as `deploy/compose.yaml`) —
  isolated `neolife` project, dedicated bridge network, dedicated PostgreSQL volume,
  Cloudflare Tunnel. Services are `neolife-web`, `neolife-postgres`, `neolife-tunnel`,
  and a profiled one-shot `neolife-seed`. There is **no gateway/proxy service** in the
  current topology: TLS termination and origin routing are handled by Cloudflare
  directly in front of `neolife-web`.
- **Migration strategy:** `prisma migrate deploy` against the production `DATABASE_URL`
  (never `migrate dev`); migrations are forward-only, so rollback is app-only.
- **Secrets:** Root-owned env file injected as container environment variables at run
  time via `docker compose --env-file`; never committed, never in `compose.production.yaml`
  (which contains only `${VAR}` placeholders). See `docs/DEPLOYMENT.md` §0.

## Testing

- **Official totals:** the suite contains **222 tests** — **167** run without
  `DATABASE_URL`, plus **55** DB-enabled tests that require local PostgreSQL. Tests gate
  on `const DB_AVAILABLE = Boolean(process.env.DATABASE_URL)`, so a run without that
  variable legitimately reports fewer tests. See `docs/PROJECT_PLAN.md`.
- **Unit/pure:** Vitest (`pnpm test`) — no DB required.
- **Integration:** Vitest with DB — `tests/*-persistence.test.ts`, `tests/qualification.test.ts`,
  `tests/funnel-events.test.ts`, `tests/user-management-db.test.ts`,
  `tests/assignment-{integration,reassignment}.test.ts`, `tests/lead-persistence.test.ts`
  (require `docker compose up -d`).
- **DB integration:** `scripts/test-db-integration.js` — 30 tests validating FunnelEvent schema (D-031 no-PII), QualificationToken schema, single-use consumption, replay prevention, durability, and qualification workflow. Run from WSL (Windows node has WSL PostgreSQL networking issues).
- **E2E:** Playwright with system Chrome (`pnpm exec playwright test`) — 11 tests across
  5 specs. `e2e/global-setup.ts` creates shared Owner and Staff sessions before the run.
