# NEOLIFE — Recovery Procedures

## Overview

This document describes how to recover from failures during Phase B
(Owner-controlled lead assignment) and how to verify the system is healthy
after recovery.

## Prerequisites

- Docker 29.x installed
- Access to the Owner's server infrastructure (`ooadmin` account)
- Project source at `/opt/ooflowdesk/neolife/`

## Recovery scenarios

### 1. Lost or corrupted admin credentials

1. Reset the admin password via the database:
   ```bash
   # Connect to PostgreSQL
   psql $DATABASE_URL -c "SELECT id, email, role FROM \"User\" WHERE role = 'admin';"

   # Reset password via Better Auth (programmatic):
   # The password column is on the Account table, not User. Use:
   pnpm exec tsx -e "
   import { auth } from './src/lib/auth';
   auth.api.resetPassword({ body: { email: 'office@example.com' } });
   "
   ```
2. **Do NOT** hard-code passwords. Use `scripts/seed-admin.ts` with env vars:
   ```bash
   ADMIN_EMAIL=office@example.com ADMIN_PASSWORD=<12+ char password> \
     pnpm exec tsx scripts/seed-admin.ts
   ```

### 2. Lost or corrupted Staff credentials

1. Re-provision via the dev seed script:
   ```bash
   STAFF_EMAIL=colleague@neolife.local STAFF_PASSWORD=<12+ char password> \
     STAFF_NAME="Colleague" pnpm exec tsx scripts/seed-staff.ts
   ```
2. If the Staff account already exists, the script updates it idempotently.
3. Reset password via Better Auth if needed (see scenario 1).

### 3. Database schema drift (assignedUserId column missing)

If the migration `20260917000000_add_lead_ownership` was not applied:

1. Verify migration status:
   ```bash
   pnpm prisma migrate status
   ... prisma migrate deploy
   ```

### 3. Database schema drift (assignedUserId column missing)

If the migration `20260917000000_add_lead_ownership` was not applied:

1. Verify migration status:
   ```bash
   pnpm prisma migrate status
   ... prisma migrate deploy
   ```

### 4. Database schema drift (LeadEvent.userId missing)

If the Phase C migration `20260917120000_add_leadevent_actor` was not applied:

1. Verify migration status:
   ```bash
   pnpm prisma migrate status
   pnpm prisma migrate dev --name add_leadevent_actor
   ```

2. The `userId` column is nullable — existing LeadEvent rows are preserved with `userId = NULL`.

### 5. Database schema drift (FunnelEvent / QualificationToken missing)

If the Phase D migration `20260918000000_add_funnel_events` was not applied:

1. Verify migration status:
   ```bash
   pnpm prisma migrate status
   pnpm prisma migrate deploy
   ```

2. If the tables already exist (manual creation), mark the migration as applied:
   ```bash
   pnpm prisma db execute --file prisma/migrations/20260918000000_add_funnel_events/migration.sql
   ```

### 6. Prisma client out of sync

```bash
pnpm prisma generate
pnpm typecheck
```

### 5. Tests failing (DB connectivity)

The DB-dependent tests (`tests/auth.test.ts`, `tests/lead-persistence.test.ts`,
`tests/meeting-persistence.test.ts`, `tests/assignment-integration.test.ts`,
`tests/qualification.test.ts`, `tests/funnel-events.test.ts`)
require a local PostgreSQL instance:

```bash
docker compose up -d
pnpm test
```

Pure-logic tests (`tests/assignment-authorization.test.ts`,
`tests/attribution.test.ts`, `tests/lead-validation.test.ts`,
`tests/rate-limit.test.ts`, `tests/catalogue-data.test.ts`,
`tests/meeting-management.test.ts`, `tests/qualification.test.ts` pure tests,
`tests/funnel-events.test.ts` pure tests) run without a database.

For DB integration validation when Windows Node.js cannot reach WSL PostgreSQL:
```bash
cd /home/gman/neolife-dbtest
node integration.js
```
This runs 30 DB integration tests directly against PostgreSQL via the `pg` library from within WSL.

### 6. Assignment authorization broken

If Staff users can see or assign leads they shouldn't:

1. Verify `requireAdmin()` is called at the top of `assignLead` (not just `requireCrmUser`).
2. Verify `getCrmUsers` is owner-only (calls `requireAdmin`).
3. Verify lead detail page uses `requireCrmUser` + `where` scoping.
4. Verify leads list page uses `requireCrmUser` + ownership filter.
5. Run `pnpm test -- tests/assignment-authorization.test.ts` — all 15 tests must pass.
6. Check `LeadEvent` table for unauthorized `lead_assigned`/`lead_unassigned` events.

### 7. Lint or typecheck failures

```bash
pnpm lint
pnpm typecheck
```

All changed files must pass lint and typecheck. Pre-existing errors in
`.kilo/worktrees/` are unrelated to the application source.

## Health checks

After any recovery operation:
1. `pnpm prisma validate` — schema valid
2. `pnpm prisma generate` — client generated
3. `pnpm lint` — 0 errors (excluding `.kilo/worktrees/`)
4. `pnpm typecheck` — 0 errors
5. `pnpm test -- tests/assignment-authorization.test.ts` — 15/15 pass
6. `pnpm build` — builds successfully (all routes render)
7. (With PostgreSQL) `cd /home/gman/neolife-dbtest && node integration.js` — 30/30 DB tests pass
