# NEOLIFE — Recovery Procedures

## Overview

How to recover from common failures, and how to verify the system is healthy
afterwards. Covers local development and the live production deployment
(`https://neolife.ooflowdesk.com`).

> **Production context.** Production is **live** and runs as an isolated Docker
> Compose project (`neolife`) on the Owner's server, reached through a dedicated
> Cloudflare Tunnel. Production secrets live only in a root-owned secret file and
> are injected as container environment variables at run time. **Never** read,
> print, log, or commit production secret values, and never place them in this
> document. See `docs/DEPLOYMENT.md` §0 and §6.

## Prerequisites

**Local development**

- Node.js 24+, pnpm 10+
- Docker (for the local PostgreSQL 16 instance): `docker compose up -d`
- Repository at the project root; `.env` present (copy from `.env.example`)

**Production**

- Docker on the Owner server
- SSH access to the Owner server (`ssh ooflowdesk-remote`)
- Deployment authorization from the Owner for any production change

## Commands

This project uses **pnpm** (see `pnpm-lock.yaml` / `pnpm-workspace.yaml`).

| Purpose | Command |
|---|---|
| Install dependencies | `pnpm install` |
| Lint | `pnpm lint` |
| Type-check | `pnpm typecheck` |
| Unit + DB tests | `pnpm test` |
| E2E tests | `pnpm exec playwright test` (requires a running server + PostgreSQL) |
| Dev server | `pnpm dev` → <http://localhost:3000> |
| Production build | `pnpm build` |
| Regenerate Prisma client | `pnpm prisma:generate` |
| Migration status | `pnpm exec prisma migrate status` |
| Apply migrations | `pnpm exec prisma migrate deploy` |

## Migration inventory

Ten migrations, in order. Applied with `prisma migrate deploy` (never
`migrate dev` against a shared or production database).

| # | Migration | Purpose |
|---|---|---|
| 1 | `20260908191429_init` | Initial schema (Lead, LeadEvent, Meeting, FollowUp, ProductInterest) |
| 2 | `20260908203316_add_better_auth` | Better Auth tables (User, Session, Account, Verification) |
| 3 | `20260908204036_add_user_password` | Temporary user password column |
| 4 | `20260908204326_add_account_issuer_subject` | Account issuer/subject columns |
| 5 | `20260908204415_drop_user_password` | Dropped the temporary column (Better Auth owns credentials) |
| 6 | `20260913061907_add_product_catalogue` | Product catalogue |
| 7 | `20260917000000_add_lead_ownership` | `Lead.assignedUserId` + ownership indexes |
| 8 | `20260917120000_add_leadevent_actor` | `LeadEvent.userId` (canonical audit actor) |
| 9 | `20260918000000_add_funnel_events` | `FunnelEvent` + `QualificationToken` |
| 10 | `20260919000000_add_user_management_fields` | `User.mustChangePassword`, `User.isActive` |

## Recovery scenarios

### 1. Lost or corrupted Owner (admin) credentials

`scripts/seed-admin.ts` is idempotent on **role**, but it does **not** reset an
existing account's password. Choose one:

**Option A — re-provision (destroys the existing account and its sessions):**

```bash
# 1. Remove the existing Owner account (cascades sessions/accounts)
psql "$DATABASE_URL" -c 'DELETE FROM "User" WHERE email = '\''office@example.com'\'';'

# 2. Recreate with a new password (hashed by Better Auth)
ADMIN_EMAIL='office@example.com' \
ADMIN_PASSWORD='<12+ char password>' \
  pnpm exec tsx scripts/seed-admin.ts
```

**Option B — reset via Better Auth's `changePassword`** (requires knowing the
current password; does not work for a forgotten password):

```bash
pnpm exec tsx -e "
  import { auth } from './src/lib/auth';
  await auth.api.changePassword({
    body: { newPassword: '<12+ char password>', currentPassword: '<current>', revokeOtherSessions: true },
  });
"
```

> Do **not** hand-write plaintext passwords or password hashes into the database.
> Better Auth owns credential storage on the `Account` table, not `User`.

### 2. Lost or corrupted Staff credentials

```bash
STAFF_EMAIL='colleague1@neolife.local' \
STAFF_PASSWORD='<12+ char password>' \
STAFF_NAME='Colleague One' \
  pnpm exec tsx scripts/seed-staff.ts
```

- The script is idempotent on `role` — it will not reset an existing password.
- Use the same delete-then-seed approach as scenario 1 if the password is lost.
- To **deactivate** rather than delete, set `isActive = false` (or use the Owner-only
  `/admin/users` page). `getCrmUser()` returns `null` for inactive users, so a
  deactivated account cannot authenticate or reach any protected CRM route.
- A Staff account stuck on `mustChangePassword = true` is redirected to
  `/admin/change-password` and cannot reach the CRM until the change is completed.
  Clear it server-side if the account is otherwise valid:

```bash
psql "$DATABASE_URL" -c 'UPDATE "User" SET "mustChangePassword" = false WHERE email = '\''colleague@neolife.local'\'';'
```

### 3. A migration was not applied / schema drift

1. Check what the database thinks is applied:

```bash
pnpm exec prisma migrate status
```

2. Apply anything outstanding (safe and idempotent):

```bash
pnpm exec prisma migrate deploy
```

3. If the tables/columns already exist because they were created manually, mark the
   migration applied rather than re-running it:

```bash
pnpm exec prisma migrate resolve --applied 20260918000000_add_funnel_events
```

Per-migration notes:

- **#7 `add_lead_ownership`** — adds the nullable `Lead.assignedUserId` plus indexes;
  existing rows are preserved with `assignedUserId = NULL`.
- **#8 `add_leadevent_actor`** — adds nullable `LeadEvent.userId`; existing audit rows
  are preserved with `userId = NULL`.
- **#9 `add_funnel_events`** — creates `FunnelEvent` and `QualificationToken`. If these
  tables were created by hand, resolve as applied (step 3) instead of executing the SQL.
- **#10 `add_user_management_fields`** — adds `mustChangePassword` (default `false`) and
  `isActive` (default `true`) to `User`. Existing users stay active and are not forced
  to change passwords.

### 4. Prisma client out of sync with the schema

```bash
pnpm prisma:generate
pnpm typecheck
```

Re-run this after any `prisma/schema.prisma` change, and restart a running dev server
so it picks up the new client.

### 5. Tests failing

The suite contains **247 tests**: **179** run with no database, plus **68** DB-enabled
tests that are gated on `const DB_AVAILABLE = Boolean(process.env.DATABASE_URL)`. A run
without `DATABASE_URL` legitimately reports fewer tests — that is expected, not a failure.

DB-enabled test files: `admin-actions`, `assignment-integration`, `assignment-reassignment`,
`auth`, `funnel-events`, `lead-persistence`, `meeting-persistence`, `qualification`,
`registration-persistence`, `staff-status-authorization`, `user-management-db`.

```bash
docker compose up -d          # start local PostgreSQL
pnpm test                     # expect 247 tests
pnpm exec vitest run tests/assignment-authorization.test.ts   # single file
```

`.env` is loaded by Next.js automatically but **not** by `vitest`/`tsx`. To run the
DB-enabled tests from a bare shell, export **both** variables explicitly —
`BETTER_AUTH_SECRET` is required by the qualification-token tests, so `DATABASE_URL`
alone yields 6 failures in `tests/qualification.test.ts`:

```bash
DATABASE_URL="postgresql://<user>:<password>@localhost:5433/neolife?schema=public" \
BETTER_AUTH_SECRET="<local-only value, 16+ characters>" \
  pnpm test
```

For end-to-end DB validation when Windows Node cannot reach the database directly:

```bash
pnpm exec node scripts/test-db-integration.js
```

This runs 30 DB integration tests covering `FunnelEvent` schema (D-031 no-PII),
`QualificationToken` schema, single-use consumption, replay prevention, durability, and
the qualification workflow.

### 6. E2E tests failing

E2E runs against **system Chrome** (`channel: "chrome"` in `playwright.config.ts`) — no
browser download is required. The suite starts and manages its own local server.

```bash
pnpm build                    # required first
pnpm exec playwright test     # 11 tests
```

The `webServer` command runs `node e2e/prepare-standalone.mjs` before starting
`node .next/standalone/server.js`.

- **Standalone output is incomplete by default.** `next build` does not copy
  `.next/static/` or `public/` into `.next/standalone/`, so the server returns HTML with
  no client JavaScript or CSS and every browser-driven spec fails. The prepare script
  performs the same copy the `Dockerfile` does; it is idempotent and only touches the
  local build directory.
- **`reuseExistingServer: false`.** If anything already holds port 3000 — commonly an
  `ssh -L 3000:...` tunnel to a remote host — the run fails loudly rather than adopting
  that service as its test target. Free the port; do not disable the guard.
- `e2e/global-setup.ts` resets the two fixture accounts through
  `e2e/seed-e2e-users.ts` before signing in, so their passwords are deterministic and
  stale accounts cannot block the run. The seeder manages only
  `office@test.local` (Owner) and `colleague1@neolife.local` (Staff), and refuses to act
  unless `E2E_SEED_USERS=1`, `NODE_ENV` is not `production`, and `DATABASE_URL` points at
  a loopback host. Seeding is **never** run against production.
- `global-setup.ts` then writes shared Owner and Staff session files into
  `test-results/`. That directory is gitignored; if the files are missing, delete it and
  re-run so they are regenerated.
- `e2e/.kilo/**` is excluded from spec discovery — those are untracked nested worktree
  copies whose stale specs fail on unresolvable imports.

Requirements: local PostgreSQL running with migrations applied, and
`DATABASE_URL` + `BETTER_AUTH_SECRET` exported.

### 7. Authorization broken (Staff sees too much, or can assign)

1. `assignLead` must call `await requireAdmin()` — not merely `requireCrmUser()`.
2. `getCrmUsers` and `createCrmUser` must be Owner-only (`requireAdmin()`).
3. `createCrmUser` must hardcode `role: "staff"` server-side; the `role` field is
   `input: false` in the Better Auth config so clients cannot self-assign a role.
4. `toggleUserActive` must refuse to deactivate `admin` accounts and refuse
   self-deactivation.
5. Lead list and detail queries must scope by `{ assignedUserId: user.id }` for non-admins.
6. The `(protected)` layout must redirect `mustChangePassword: true` users to
   `/admin/change-password`.
7. Run `pnpm exec vitest run tests/assignment-authorization.test.ts` — all 15 must pass.
8. Inspect the `LeadEvent` table for unauthorized `lead_assigned` / `lead_unassigned` rows.

### 8. Lint or typecheck failures

```bash
pnpm lint
pnpm typecheck
```

Both must pass with zero errors and zero warnings before commit.

### 9. Production incident

1. Confirm the live site and health endpoint:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://neolife.ooflowdesk.com/health
```

2. SSH to the Owner server and inspect container status and recent logs for the
   `neolife` project (`neolife-web`, `neolife-postgres`, `neolife-tunnel`).
3. If the application is at fault, **roll back to the previous image tag** — migrations
   are forward-only, so rollback is application-only:

```bash
sudo docker compose --env-file <secret-file> up -d
```

4. If the database is at fault, restore from the most recent dump in the project's
   `backups/` directory.
5. Take a `pg_dump` backup **before** any production migration.
6. After recovery, re-run the smoke tests in `docs/DEPLOYMENT.md` §6 steps 9–15.

> Do not change production server configuration, run migrations against production, or
> redeploy without explicit Owner authorization for that specific action.

## Health checks

Run after any recovery operation:

1. `pnpm exec prisma validate` — schema is valid
2. `pnpm prisma:generate` — client generated
3. `pnpm exec prisma migrate status` — no pending migrations
4. `pnpm lint` — 0 errors, 0 warnings
5. `pnpm typecheck` — 0 errors
6. `pnpm test` — 247/247 pass (179 non-DB + 68 DB-enabled, with PostgreSQL running)
7. `pnpm build` — builds successfully, all routes render
8. `pnpm exec node scripts/test-db-integration.js` — 30/30 DB tests pass
9. `pnpm exec playwright test` — E2E suite (see `docs/STATUS.md` for current state)
