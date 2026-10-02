# NEOLIFE — Deployment Runbook & Production Environment Specification

> **STATUS: 🟩 PRODUCTION IS LIVE** at **`https://neolife.ooflowdesk.com`**.
> NEOLIFE is deployed and managed through the Owner's existing infrastructure
> (Docker Compose + Cloudflare Tunnel), isolated from all other services.
>
> **Current release: image `neolife-web:92ee361`, commit `92ee361`, deployed and
> verified 2026-10-02.** All 10 Prisma migrations are applied.
>
> This document contains **no production secrets**. Production values must never
> be committed to Git, documentation, `.env.example`, test fixtures, or logs.
> Production secrets are held in a root-owned secret file on the server and are
> injected as container environment variables at run time.
>
> For redeploying an existing release, or for deploying a new release, see §6.
> For the record of what has actually been deployed, see §2 and `docs/CHANGELOG.md`.

## 0. Current production record

| Item | Value |
|---|---|
| Live origin | `https://neolife.ooflowdesk.com` |
| Current production image | **`neolife-web:92ee361`** |
| Deployed commit | **`92ee3610fbd4b704886a40f726af6ef52de6f14a`** |
| Deployed-SHA marker | `/opt/ooflowdesk/neolife/.deployed-sha` |
| Database migrations | **10 / 10 applied** |
| Application container | `neolife-web` (Next.js standalone, internal port 3000) |
| Database container | `neolife-postgres` (postgres:16-alpine, dedicated named volume) |
| Tunnel container | `neolife-tunnel` (`cloudflare/cloudflared`, remotely-managed) |
| One-shot seed service | `neolife-seed` (profile `seed`; never runs on `up -d`) |
| Compose project / network | `neolife` — dedicated, isolated |
| Compose configuration | `/opt/ooflowdesk/neolife/compose.yaml` |
| Origin public | Internet → Cloudflare → Tunnel → `neolife-web:3000` |

> ### 🟩 Release `92ee361` deployed and verified (2026-10-02)
>
> Production verification completed after the release, all **PASS**:
>
> | Area | Result |
> |---|---|
> | Owner authentication + CRM access | PASS |
> | Staff activation / deactivation | PASS |
> | Inactive Staff CRM restriction | PASS |
> | Staff reactivation | PASS |
> | Lead assignment (real Better Auth Staff ID) | PASS |
> | `LeadEvent` actor audit tracking | PASS |
> | Public routes + `/health` | PASS |
> | Container / database / tunnel health | PASS |
>
> Better Auth opaque user-ID support was confirmed against a **real production
> ID**: the deployed image's own `isValidBetterAuthUserId` and `toggleUserSchema`
> both accept a 32-character alphanumeric `User.id` (`isValidBetterAuthUserId(real)
> -> true`), while still rejecting malformed input and still accepting UUIDs.

### Resolved finding — "deployed build behind master"

Previously recorded here as an open gap and **now resolved**. Retained as history:

> *Historical (superseded 2026-10-02).* Production ran `neolife-web:b371fcf`, an image
> predating `73d73e0` (Better Auth user-ID fix), `7c31712` (deterministic E2E) and
> `f709b64` (schema alignment). In that image `toggleUserActive` and `assignLead`
> validated user IDs as UUIDs, rejecting every real Better Auth ID, so lead assignment
> and Staff activation/deactivation were affected for real users. Separately, the audit
> that preceded this release found production **six migrations behind** — it predated
> lead ownership, funnel tracking, and the P-2 user fields entirely, so those features
> had never existed in production rather than existing and being broken.

### Resolved finding — production migration gap

> *Historical (resolved 2026-10-02).* The pre-deployment audit found exactly four pending
> additive migrations:
> `20260917000000_add_lead_ownership`, `20260917120000_add_leadevent_actor`,
> `20260918000000_add_funnel_events`, `20260919000000_add_user_management_fields`.
>
> All four were applied with `prisma migrate deploy` after a verified
> `pg_dump -Fc` backup. Post-migration verification confirmed
> `Lead.assignedUserId` and `LeadEvent.userId` as **TEXT** with foreign keys and indexes
> in place, both new tables present, both new `User` columns present with migration
> defaults, and **all existing rows preserved** (1 user, 2 leads, 0 lead events). No data
> was corrupted or lost; the database was simply behind, not damaged.

Evidence of deployment is recorded in `docs/CHANGELOG.md` (entries marked 🟩
deployed, including the `neolife-web:11e64fa`, `neolife-web:b371fcf`, and
`neolife-web:92ee361` releases) and in the committed `compose.production.yaml` /
`deploy/compose.yaml` files, which pin the production image tag and origin.

## 1. Approved production architecture

```
Internet → Cloudflare → https://neolife.ooflowdesk.com
        → Cloudflare Tunnel (cloudflared)
        → dedicated NEOLIFE application service (isolated)
        → PostgreSQL (production database)
```

NEOLIFE must remain isolated from ZongFitness and all other existing services.

## 2. Owner server findings (read-only inspection, 2026-09-08)

> Superseded in part: the inspection below was performed **before** NEOLIFE was
> deployed. Items describing the pre-deployment state are retained as historical
> record. The current state is in §0.

- Docker **29.8.0** on the owner server (reachable via the `ooflowdesk-remote` SSH alias).
- Existing conventions: per-project compose dirs under `/opt/ooflowdesk/<project>/`; per-project Cloudflare tunnels (`<project>-tunnel` running `cloudflare/cloudflared`); PostgreSQL containers named `<project>-postgres` / `<project>-fitness-db` (postgres:16 used by zongfitness).
- Secrets are stored under `/opt/ooflowdesk/secrets/` (root-only) and tunnel credentials under `/opt/ooflowdesk/cloudflare-tunnel/`. **These were not read** (they contain credentials).
- *(Pre-deployment finding, now obsolete)*: no hostname/route for `neolife.ooflowdesk.com` existed at the time of inspection. A Cloudflare Tunnel route now exists and serves the live origin.
- No conflicting service for `neolife.ooflowdesk.com` was observed. NEOLIFE remains isolated from ZongFitness and all other existing services.

## 3. Deployed isolated NEOLIFE service

The following layout **exists in production** (it was created at deployment time
and is now the live arrangement):

```
/opt/ooflowdesk/neolife/
  compose.yaml            # neolife-web (standalone Next.js) + neolife-postgres + neolife-tunnel (cloudflared) + neolife-seed (profiled)
  backups/                # PostgreSQL dumps
```

Production secret values are **not** stored in this directory; they live in the
root-only secret file referenced by the deploy command (see §6 step 2).

- `neolife-web`: runs `node .next/standalone/server.js` (Next.js standalone output), listens on an internal port (e.g. 3000) on a **dedicated Docker network** (e.g. `neolife`) — NOT the host network.
- `neolife-postgres`: postgres:16, dedicated named volume.
- `neolife-tunnel`: `cloudflare/cloudflared` with the `neolife.ooflowdesk.com` hostname, routing to `neolife-web:3000`.
- Isolation: separate compose project + separate network; no shared volumes/network with ZongFitness.

## 4. Production environment variables (names only — values supplied securely at deploy time)

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Production PostgreSQL connection string (injected into `web` and `seed`) | Yes (runtime) |
| `BETTER_AUTH_SECRET` | Better Auth signing/encryption secret (`openssl rand -base64 32`) | Yes (runtime) |
| `BETTER_AUTH_URL` | Production origin, i.e. `https://neolife.ooflowdesk.com` | Yes (runtime) |
| `POSTGRES_PASSWORD` | Password for the `neolife-postgres` container | Yes (runtime) |
| `TUNNEL_TOKEN` | Cloudflare Tunnel connector token (`neolife-tunnel`) — a production credential | Yes (runtime) |
| `ADMIN_EMAIL` | Admin account email for `scripts/seed-admin.ts` | Yes (one-time seed) |
| `ADMIN_PASSWORD` | Admin account password (≥12 chars) for the seed | Yes (one-time seed) |
| `NEXT_PUBLIC_SITE_URL` | Public site origin | Baked into `compose.production.yaml` as a literal |

> `NODE_ENV=production` and `PORT`/`HOSTNAME` are set by the container runtime as needed.

## 5. Database & migration strategy

- Production database: PostgreSQL 16 (matching local dev).
- Apply migrations idempotently with `prisma migrate deploy` (never `migrate dev` in production).
- Migrations are additive/forward-only; a backup is taken before each migration run.
- Admin account is provisioned once via `scripts/seed-admin.ts` with production `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## 6. Deployment runbook (for redeploying a new release)

> This runbook is retained from the original pre-deployment plan and is now the
> procedure for shipping an **update** to the live production service. It is
> executed only when a release is explicitly authorized by the Owner. It does not
> describe initial infrastructure creation, which is already complete (§3).

### 6.0 Server access requirement (verified 2026-10-02)

The secret store at `/opt/ooflowdesk/secrets/` is **root-owned and not readable by the
deployment user**. The documented command therefore requires **sudo access** on the
server:

```
sudo docker compose --env-file /opt/ooflowdesk/secrets/neolife.env <command>
```

If sudo is unavailable, an authorized operator can instead supply the required
variables through the calling shell's environment, taking care never to print or
persist a secret value. That path was used for the `92ee361` release and worked, but
sudo is the intended mechanism. Whichever path is used:

- never echo, log, or commit a secret value
- never copy a secret file to a world-readable location
- the compose file itself must continue to contain only `${VAR}` placeholders

### 6.1 Seed service note

The `seed` service references the same application image as `web`. When a new release is
deployed, **update both image references together** so the two cannot drift. The `seed`
service runs under profile `seed` and was **not executed** during the `92ee361`
deployment; it is invoked explicitly only when a new Owner account must be created.

1. **Database preparation** — confirm the production PostgreSQL database and user exist with minimal privileges (already provisioned).
2. **Environment configuration** — production `DATABASE_URL`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TUNNEL_TOKEN` (and seed `ADMIN_EMAIL`/`ADMIN_PASSWORD`) live only in the root-owned secret file; they are injected at run time via `--env-file` and are never in Git.
3. **Build/image preparation** — `pnpm build` produces `.next/standalone/`; package `server.js`, `.next/static`, `.next/standalone`, and `public/` into a `neolife-web:<RELEASE_SHA>` image.
4. **Prisma migrate** — run `pnpm exec prisma migrate deploy` against the production `DATABASE_URL` (never `migrate dev`).
5. **Start the dedicated NEOLIFE service** — `docker compose up -d` for the `neolife` project (isolated network).
6. **Cloudflare Tunnel routing** — the `neolife-tunnel` route for `neolife.ooflowdesk.com` → `neolife-web:3000` already exists; confirm it is healthy after each release.
7. **Hostname/HTTPS verification** — confirm `https://neolife.ooflowdesk.com` serves over HTTPS via Cloudflare; verify `/health`.
8. **Admin provisioning** — `scripts/seed-admin.ts` is required only when a new Owner account must be created; it runs via the `seed` profile and never on the long-running `web` service.
9. **Production health check** — `GET https://neolife.ooflowdesk.com/health` → 200 `{"status":"ok"}`.
10. **Public-route smoke tests** — `/`, `/campaign/launch`, `/register-interest`, `/privacy`, `/terms`, `/disclosures` all 200.
11. **Lead submission test** — submit a test lead; verify it reaches the CRM.
12. **Attribution verification** — land on `/campaign/test?utm_source=...` and confirm the lead carries the attribution.
13. **Admin authentication test** — sign in at `/admin/login`; confirm `/admin/leads` is reachable and unauthenticated access redirects.
14. **CRM test** — view a lead, update status, add a follow-up note.
15. **Meeting workflow smoke test** — schedule a meeting, set attendance/outcome, verify events.
16. **Rollback procedure** — redeploy the previous `neolife-web` image tag and re-run the health check; migrations are forward-only so rollback is app-only.
17. **Database backup/restore** — `pg_dump` backups to `neolife/backups/`; restore procedure documented and tested before first production data is committed.

## 7. Security notes

- No production secrets are in this repository or documentation.
- The Cloudflare Tunnel connector token is a production credential; it must be placed only in the server's secret store / root-only `.env` (like `/opt/ooflowdesk/secrets`), never in Git, `.env.example`, logs, or screenshots.
- The application already provides security headers, CSRF/session handling, authorization, validation, and a `/health` endpoint (see `docs/STATUS.md`).

