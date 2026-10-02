# AGENTS.md — NEOLIFE

## Package manager

This project uses **pnpm** (see `pnpm-lock.yaml` / `pnpm-workspace.yaml`). Do not use
`npm` or `yarn`, and do not introduce a second lockfile. All commands below assume pnpm.

## Development commands

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Lint | `pnpm lint` (strict gate: `pnpm exec eslint . --max-warnings 0`) |
| Type-check | `pnpm typecheck` |
| Unit + DB tests | `pnpm test` |
| Single test file | `pnpm exec vitest run tests/<file>.test.ts` |
| E2E tests | `pnpm exec playwright test` (requires a running server + PostgreSQL) |
| Dev server | `pnpm dev` — `http://localhost:3000` |
| Production build | `pnpm build` |
| Start production | `node .next/standalone/server.js` |
| Prisma generate | `pnpm prisma:generate` |
| Prisma migrate (local dev) | `pnpm prisma:migrate:dev` |
| Prisma migrate (apply, e.g. prod) | `pnpm exec prisma migrate deploy` |
| Prisma validate | `pnpm prisma:validate` |
| Seed Owner | `ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm exec tsx scripts/seed-admin.ts` |
| Seed Staff | `STAFF_EMAIL=… STAFF_PASSWORD=… STAFF_NAME=… pnpm exec tsx scripts/seed-staff.ts` |

## Testing conventions

- **Official total: 247 tests** — **179** run without `DATABASE_URL`, plus **68**
  DB-enabled tests that require a local PostgreSQL instance.
- DB-dependent suites gate on `const DB_AVAILABLE = Boolean(process.env.DATABASE_URL)`.
  A run without that variable legitimately reports fewer tests; that is not a failure.
- `vitest` and `tsx` do **not** auto-load `.env`. Next.js does. To run DB-enabled
  tests from a bare shell, export `DATABASE_URL` **and** `BETTER_AUTH_SECRET`.
  `BETTER_AUTH_SECRET` is required by the qualification-token tests, so setting
  `DATABASE_URL` alone produces 6 failures in `tests/qualification.test.ts`.
- E2E runs against **system Chrome** (`channel: "chrome"`); no browser download needed.

### E2E environment

- `pnpm build` first, then `pnpm playwright test` (11 tests). The Playwright
  `webServer` command runs `node e2e/prepare-standalone.mjs` before starting the
  standalone server, because `next build` does not copy `.next/static/` or `public/`
  into `.next/standalone/`. Without that step the server returns HTML with no client
  JavaScript or CSS.
- `reuseExistingServer: false`. If anything already holds port 3000 — for example an
  `ssh -L 3000:...` tunnel to a remote host — the run fails loudly instead of adopting
  that service as its test target.
- `e2e/seed-e2e-users.ts` resets two local fixture accounts before each run
  (`office@test.local`, `colleague1@neolife.local`) so their passwords are
  deterministic. It refuses to run unless `E2E_SEED_USERS=1`, `NODE_ENV` is not
  `production`, and `DATABASE_URL` points at a loopback host. Never seed production.
- `e2e/global-setup.ts` writes shared Owner/Staff session files into `test-results/`.
- `e2e/.kilo/**` is excluded from spec discovery; those are untracked nested worktree
  copies whose stale specs fail on unresolvable imports.

## Architecture notes

- **Test runner:** Vitest (not Jest). Unit tests in `tests/`, E2E in `e2e/`.
- **E2E runner:** Playwright with system Chrome (`playwright.config.ts`).
- **Project type:** `"type": "module"` — use `import/export`, not `require()`.
- **Aliases:** `@/` maps to `src/` (configured in both `tsconfig.json` and `vitest.config.ts`).
- **Database:** PostgreSQL 16 via Prisma. Local dev uses `docker compose up -d`.
  Schema changes require a new migration; never edit an applied migration.
- **User IDs:** `User.id` is a TEXT column holding an opaque ~32-char Better Auth
  identifier, **not** a UUID. Every user-reference column (`Lead.assignedUserId`,
  `LeadEvent.userId`, `Meeting.userId`, `FollowUp.userId`) must therefore stay
  TEXT-compatible. Entity IDs such as `Lead.id` and `Meeting.id` remain UUID
  (`gen_random_uuid()`). Do not add `@db.Uuid` to a user-reference field: PostgreSQL
  rejects Better Auth IDs as uuid syntax, and a migration generated from such an
  annotation would issue a destructive `DROP COLUMN` + `ADD COLUMN UUID`.
- **Auth:** Better Auth 1.7.2 with `@/lib/auth.ts`. Server-side session checks via
  `src/server/auth/requireCrmUser.ts` (`getCrmUser`, `requireCrmUser`, `requireAdmin`).
- **Server Actions:** marked `"use server"`. Guard with `await requireAdmin()` or
  `await requireCrmUser()`. Never trust role/assignment values from client input —
  `role` and `isActive` are Better Auth `additionalFields` with `input: false`.
- **Production:** live at `https://neolife.ooflowdesk.com`. See `docs/DEPLOYMENT.md`.
  Secrets are never committed and must never be printed or logged.

## Documentation

- `README.md` — public project entry point.
- `docs/PROJECT_PLAN.md` — authoritative scope, phase, and completion rules.
- `docs/STATUS.md` — start with the **Current State Summary** at the top; entries below
  it are dated history.
- `docs/DECISIONS.md` — Owner-approved decisions. Append dated clarifications; do not
  rewrite historical decisions.
- `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/RECOVERY.md`,
  `docs/DEPLOYMENT_EXECUTION_PLAN.md`, `docs/CHANGELOG.md`.
- Update documentation in the same change as the behaviour it describes. When work
  changes a documented number, state the new authoritative figure and mark the old one
  superseded rather than silently editing it.

## CI / pre-commit checklist

1. `pnpm typecheck` — must pass
2. `pnpm exec eslint . --max-warnings 0` — must pass
3. `pnpm test` — all non-DB tests must pass (179); DB tests skip without `DATABASE_URL`
   (68) and must pass when PostgreSQL is available (247 total)
4. Confirm no secrets, credentials, or production configuration are staged
