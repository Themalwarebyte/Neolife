# NEOLIFE — Deployment Runbook & Production Environment Specification

> **PREPARATION ONLY — NO DEPLOYMENT AUTHORIZED.**
> This document is a runbook for a future, explicitly-authorized deployment.
> It contains no production secrets. Production values must never be committed
> to Git, documentation, `.env.example`, test fixtures, or logs.
>
> Status: §11.6 🟨 NOT COMPLETE · §11.7 ⚪ NOT STARTED.

## 1. Approved production architecture

```
Internet → Cloudflare → https://neolife.ooflowdesk.com
        → Cloudflare Tunnel (cloudflared)
        → dedicated NEOLIFE application service (isolated)
        → PostgreSQL (production database)
```

NEOLIFE must remain isolated from ZongFitness and all other existing services.

## 2. Owner server findings (read-only inspection, 2026-09-08)

- Docker **29.8.0** on the owner server (reachable via the `ooflowdesk-remote` SSH alias).
- Existing conventions: per-project compose dirs under `/opt/ooflowdesk/<project>/`; per-project Cloudflare tunnels (`<project>-tunnel` running `cloudflare/cloudflared`); Caddy gateways (`<project>-gateway`, 80/443); PostgreSQL containers named `<project>-postgres` / `<project>-fitness-db` (postgres:16 used by zongfitness).
- Secrets are stored under `/opt/ooflowdesk/secrets/` (root-only) and tunnel credentials under `/opt/ooflowdesk/cloudflare-tunnel/`. **These were not read** (they contain credentials).
- No hostname/route for `neolife.ooflowdesk.com` exists yet. It would be added as a new Cloudflare Tunnel route.
- No conflicting service for `neolife.ooflowdesk.com` was observed.

## 3. Proposed isolated NEOLIFE service (to be created at deployment time)

```
/opt/ooflowdesk/neolife/
  compose.yaml            # neolife-web (standalone Next.js) + neolife-postgres + neolife-tunnel (cloudflared)
  .env                    # production secrets (NOT committed; root-only, like /opt/ooflowdesk/secrets)
  backups/                # PostgreSQL dumps
```

- `neolife-web`: runs `node .next/standalone/server.js` (Next.js standalone output), listens on an internal port (e.g. 3000) on a **dedicated Docker network** (e.g. `neolife`) — NOT the host network.
- `neolife-postgres`: postgres:16, dedicated named volume.
- `neolife-tunnel`: `cloudflare/cloudflared` with the `neolife.ooflowdesk.com` hostname, routing to `neolife-web:3000`.
- Isolation: separate compose project + separate network; no shared volumes/network with ZongFitness.

## 4. Production environment variables (names only — values supplied securely at deploy time)

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Production PostgreSQL connection string | Yes (runtime) |
| `BETTER_AUTH_SECRET` | Better Auth signing/encryption secret (`openssl rand -base64 32`) | Yes (runtime) |
| `BETTER_AUTH_URL` | Production origin, e.g. `https://neolife.ooflowdesk.com` | Yes (runtime) |
| `ADMIN_EMAIL` | Admin account email for `scripts/seed-admin.ts` | Yes (one-time seed) |
| `ADMIN_PASSWORD` | Admin account password (≥12 chars) for the seed | Yes (one-time seed) |
| `NEXT_PUBLIC_SITE_URL` | Public site origin (informational) | Optional (not referenced by code at this time) |

> `NODE_ENV=production` and `PORT`/`HOSTNAME` are set by the container runtime as needed.

## 5. Database & migration strategy

- Production database: PostgreSQL 16 (matching local dev).
- Apply migrations idempotently with `prisma migrate deploy` (never `migrate dev` in production).
- Migrations are additive/forward-only; a backup is taken before each migration run.
- Admin account is provisioned once via `scripts/seed-admin.ts` with production `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## 6. Deployment runbook (EXECUTE ONLY WHEN AUTHORIZED)

1. **Database preparation** — create the production PostgreSQL database and user; grant minimal privileges.
2. **Environment configuration** — place production `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (and seed `ADMIN_EMAIL`/`ADMIN_PASSWORD`) in the server's secret store / root-only `.env` (never in Git).
3. **Build/image preparation** — `pnpm build` produces `.next/standalone/`; package `server.js`, `.next/static`, `.next/standalone`, and `public/` (if any) into the `neolife-web` image.
4. **Prisma migrate** — run `pnpm exec prisma migrate deploy` against the production `DATABASE_URL`.
5. **Start the dedicated NEOLIFE service** — `docker compose up -d` for the `neolife` project (isolated network).
6. **Cloudflare Tunnel routing** — add/configure the `neolife-tunnel` route for `neolife.ooflowdesk.com` → `neolife-web:3000`.
7. **Hostname/HTTPS verification** — confirm `https://neolife.ooflowdesk.com` serves over HTTPS via Cloudflare; verify `/health`.
8. **Admin provisioning** — run `scripts/seed-admin.ts` once with production credentials; then remove those env values if appropriate.
9. **Production health check** — `GET https://neolife.ooflowdesk.com/health` → 200 `{"status":"ok"}`.
10. **Public-route smoke tests** — `/`, `/campaign/launch`, `/register-interest`, `/privacy`, `/terms`, `/disclosures` all 200.
11. **Lead submission test** — submit a test lead; verify it reaches the CRM.
12. **Attribution verification** — land on `/campaign/test?utm_source=...` and confirm the lead carries the attribution.
13. **Admin authentication test** — sign in at `/admin/login`; confirm `/admin/leads` is reachable and unauthenticated access redirects.
14. **CRM test** — view a lead, update status, add a follow-up note.
15. **Meeting workflow smoke test** — schedule a meeting, set attendance/outcome, verify events.
16. **Rollback procedure** — redeploy the previous `neolife-web` image tag and re-run the health check; migrations are forward-only so rollback is app-only.
17. **Database backup/restore** — schedule `pg_dump` backups to `neolife/backups/`; restore procedure documented and tested before first production data is committed.

## 7. Security notes

- No production secrets are in this repository or documentation.
- The Cloudflare Tunnel connector token is a production credential; it must be placed only in the server's secret store / root-only `.env` (like `/opt/ooflowdesk/secrets`), never in Git, `.env.example`, logs, or screenshots.
- The application already provides security headers, CSRF/session handling, authorization, validation, and a `/health` endpoint (see `docs/STATUS.md`).

