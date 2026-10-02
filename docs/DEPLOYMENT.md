# NEOLIFE — Deployment Runbook & Production Environment Specification

> **STATUS: 🟩 PRODUCTION IS LIVE** at **`https://neolife.ooflowdesk.com`**.
> NEOLIFE is deployed and managed through the Owner's existing infrastructure
> (Docker Compose + Cloudflare Tunnel), isolated from all other services.
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
| Current production image | `neolife-web:b371fcf` |
| Application container | `neolife-web` (Next.js standalone, internal port 3000) |
| Database container | `neolife-postgres` (postgres:16-alpine, dedicated named volume) |
| Tunnel container | `neolife-tunnel` (`cloudflare/cloudflared`, remotely-managed) |
| One-shot seed service | `neolife-seed` (profile `seed`; never runs on `up -d`) |
| Compose project / network | `neolife` — dedicated, isolated |
| Origin public | Internet → Cloudflare → Tunnel → `neolife-web:3000` |

> ### ⚠️ Deployed build is behind `master`
>
> Production still runs `neolife-web:b371fcf`. GitHub `master` has since advanced past
> three commits that are **not** deployed:
>
> | Commit | Effect |
> |---|---|
> | `73d73e0` | fix: support Better Auth user IDs in admin actions |
> | `7c31712` | test: make local E2E environment deterministic |
> | `f709b64` | fix: align user relation IDs with Better Auth text IDs |
>
> The most significant is `73d73e0`. Before it, `toggleUserActive` and `assignLead`
> validated user IDs as UUIDs, which rejects every real Better Auth ID — so in the
> currently deployed image **lead assignment and Staff activation/deactivation are
> affected for real users**. Treat those two features as broken in production until a
> new image is built and deployed. See `docs/STATUS.md`.
>
> `f709b64` is a schema-alignment change only and generated no migration, so no
> `migrate deploy` step is required for it — but the rebuilt application still requires
> `pnpm prisma generate` against the corrected schema (see §6 step 3).

Evidence of deployment is recorded in `docs/CHANGELOG.md` (entries marked 🟩
deployed, including the `neolife-web:11e64fa` and `neolife-web:b371fcf`
releases) and in the committed `compose.production.yaml` / `deploy/compose.yaml`
files, which pin the production image tag and origin.

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

