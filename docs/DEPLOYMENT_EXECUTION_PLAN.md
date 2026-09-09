# NEOLIFE — §11.7 Deployment Execution Plan (DRAFT — not executed)

> Authoritative reference: `docs/DEPLOYMENT.md` (architecture + runbook). This plan
> details the **exact** execution steps, resource boundaries, and Owner decisions.
>
> **Nothing in this plan has been executed.** §11.7 = ⚪ NOT STARTED.
> Production deployment = NOT AUTHORIZED. Paid advertising = NOT AUTHORIZED.
>
> Cloudflare routing decision (Owner, accepted): **Option A — dedicated NEOLIFE tunnel**
> (Option B only if a tunnel is confirmed dedicated to NEOLIFE; Option C — modify a
> shared tunnel — NOT approved; Option D — alternative gateway — requires further review).

## 0. Verified baseline
- Approved app commit: `3994e9d` (43/43 tests, lint/typecheck/build, E2E 1/1).
- Server (read-only pre-flight): Docker 29.8.0; `ooadmin` has Docker access (no sudo for docker);
  `/opt/ooflowdesk/` owned by `ooadmin`; secrets under root-owned `/opt/ooflowdesk/secrets/`;
  no `neolife` project/network/container/volume exists; `neolife.ooflowdesk.com` resolves publicly (A+AAAA).
- Conventions: `<project>-web`, `<project>-postgres`, `<project>-tunnel` (cloudflared), per-project dir, dedicated bridge network.

## 1. Release artifact / image strategy
Build the image **locally** from the approved commit, transfer as a tarball, `docker load` on the server. The server is not used for builds, and the source repo is not modified on the server.

1. (Local, Kilo) Add `Dockerfile` to the repo (single planned source change, flagged to Owner). Multi-stage:
   - **build stage** `node:24-alpine`: copy `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `prisma/`, `src/`, `scripts/`, `*.config.*` → `pnpm install --frozen-lockfile` → `pnpm prisma generate` → `pnpm build` (→ `.next/standalone`).
   - **runtime stage** `node:24-alpine`: copy `node_modules`, `prisma/`, `src/`, `scripts/`, `package.json`, `prisma.config.ts`, `.next/standalone`, `.next/static`, `public/` → `ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0` → `CMD ["node", ".next/standalone/server.js"]`.
   - A "full" image (source + node_modules + .next) is used so `prisma migrate deploy` and the admin seed run inside the container. Disk is plentiful (169G free).
2. (Local, Kilo) `docker build -t neolife-web:3994e9d .`
3. (Local, Kilo) `docker save neolife-web:3994e9d | gzip > neolife-web-3994e9d.tar.gz`
4. (Local→server, Kilo) `scp neolife-web-3994e9d.tar.gz ooflowdesk-remote:/home/ooadmin/`
5. (Server, Kilo as ooadmin) `docker load < /home/ooadmin/neolife-web-3994e9d.tar.gz`

## 2. Server filesystem
```
/opt/ooflowdesk/neolife/
  compose.yaml          ooadmin:ooadmin  0644   (no secrets)
  .env                  root:root        0600   (production secrets — sudo)
  backups/              ooadmin:ooadmin  0700
```
- `mkdir -p /opt/ooflowdesk/neolife/backups` — **non-sudo** (ooadmin owns `/opt/ooflowdesk`).
- `compose.yaml` and `backups/` — **non-sudo**.
- `.env` (secrets) — **sudo**: root-owned `0600` (matches `/opt/ooflowdesk/secrets/` convention).
- Only **one** category of sudo operation: creating/chmod-ing the root-owned `.env` (§11).

## 3. Docker compose.yaml design (additive; no host ports; dedicated network)
```yaml
name: neolife

services:
  web:
    image: neolife-web:3994e9d
    container_name: neolife-web
    restart: unless-stopped
    env_file: [.env]
    depends_on:
      db: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    networks: [neolife]

  db:
    image: postgres:16-alpine
    container_name: neolife-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: neolife
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: neolife
    volumes: [neolife_pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U neolife -d neolife"]
      interval: 5s
      timeout: 3s
      retries: 10
    networks: [neolife]

  tunnel:
    image: cloudflare/cloudflared:2026.7.3
    container_name: neolife-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    networks: [neolife]

networks:
  neolife:
    driver: bridge

volumes:
  neolife_pgdata:
```
- **No `ports:` mappings** → no host port published → no collision with occupied ports (3000/3001/3002/8080/...).
- **Dedicated `neolife` bridge** → no shared network with any existing application.
- `depends_on` is the only intra-project dependency; **no dependency on existing containers**.

## 4. PostgreSQL strategy
- Dedicated database `neolife`, user `neolife`, password from `POSTGRES_PASSWORD` (root `.env`), volume `neolife_pgdata`.
- In-container `DATABASE_URL` = `postgresql://neolife:<pw>@db:5432/neolife?schema=public` (service DNS `db` on the `neolife` network).
- Migration (Kilo, non-sudo, inside container): `docker compose run --rm web pnpm exec prisma migrate deploy`.
  - Forward-only; never `migrate dev`/`reset`/`db push`; never targets another application's database.
- Backup (Kilo, non-sudo): `docker compose exec -T db pg_dump -U neolife neolife > backups/neolife-$(date +%F-%H%M%S).sql`.
- Rollback: forward-only + redeploy previous image; **never drop the DB/volume**. Restore-from-backup only with explicit Owner authorization (destructive).

## 5. Production environment (variable NAMES only — values never in Git/logs/chat)
`DATABASE_URL` · `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` (`https://neolife.ooflowdesk.com`) · `ADMIN_EMAIL` · `ADMIN_PASSWORD` (seed only) · `POSTGRES_PASSWORD` (compose DB) · `TUNNEL_TOKEN` (cloudflared, remotely-managed).
All live only in the root-owned `/opt/ooflowdesk/neolife/.env` (0600). Never in `.env.example`, docs, commit messages, or terminal output.

## 6. Cloudflare
- `neolife.ooflowdesk.com` already resolves (A+AAAA). Whether a dedicated NEOLIFE tunnel already exists **cannot be verified without reading its credential/config**, which is prohibited.
- The Owner must **create a dedicated Cloudflare Tunnel + connector token** for `neolife.ooflowdesk.com` (Option A), and set its public-hostname ingress to origin `http://neolife-web:3000`.
- **Do NOT modify any existing shared tunnel** (Option C is NOT approved).
- The connector token must never be displayed; see §12 for the secure install method.

## 7. Deployment ordering (safe sequence — NOT executed)
1. **Pre-deployment snapshot** (Kilo, read-only): `docker ps`, `docker network ls`, `ss -tlnp` — record existing state.
2. **Artifact/image prep** (Kilo, local): Dockerfile + build + save + scp + `docker load` (§1).
3. **Directory** (Kilo, non-sudo): `mkdir -p /opt/ooflowdesk/neolife/backups`; place `compose.yaml`.
4. **Environment** (Owner, sudo): create root-owned `.env` (§11).
5. **Dedicated DB** (Kilo, non-sudo): `docker compose up -d db` → wait healthy.
6. **Migration** (Kilo, non-sudo): `docker compose run --rm web pnpm exec prisma migrate deploy`.
7. **Web + tunnel** (Kilo, non-sudo): `docker compose up -d`.
8. **Cloudflare route** (Owner, dashboard): `neolife.ooflowdesk.com` → `http://neolife-web:3000`.
9. **HTTPS verify** (Kilo, read-only): `curl -I https://neolife.ooflowdesk.com/health`.
10. **Health check** (Kilo): `https://neolife.ooflowdesk.com/health` → 200 `{"status":"ok"}`.
11. **Admin seed** (Kilo, non-sudo): `docker compose run --rm web pnpm exec tsx scripts/seed-admin.ts` (ADMIN_EMAIL/ADMIN_PASSWORD from env).
12. **Application smoke tests** (Kilo): §9.
13. **Existing-service health verification** (Kilo, read-only): re-run snapshot; confirm all existing containers unchanged/healthy.

## 8. Rollback strategy (non-destructive to existing apps)
- App rollback: `docker compose down web tunnel` then `docker compose up -d` with a previous `neolife-web:<tag>` image (keep `db` + `neolife_pgdata` intact).
- Migrations are forward-only; DB rollback via backup restore is **only** with Owner authorization and is never automated.
- NEOLIFE rollback never touches any existing service/network/volume.

## 9. Production smoke tests
`/` · `/campaign/launch` · `/register-interest` · `/privacy` · `/terms` · `/disclosures` · `/health` · `/admin/login` (200) · unauthenticated `/admin/leads` → 307 · lead submission → persisted in DB · attribution (UTM → first-touch → lead) · admin sign-in → `/admin/leads` · lead detail · status update · follow-up · meeting create/update · HTTPS (valid cert) · Cloudflare route serves the app.

## 10. Existing infrastructure — must remain untouched
ZongFitness (all containers/DB/network) · existing PostgreSQL databases · existing Docker networks · existing Caddy gateways · existing cloudflared tunnels · existing host ports · existing secrets (`/opt/ooflowdesk/secrets/`, `cloudflare-tunnel/`) · existing DNS/routes (except the specifically authorized `neolife.ooflowdesk.com`).

## 11. Sudo boundary
Only **one** sudo operation: creating the root-owned secrets file. Owner copy-paste (run on the server as `ooadmin`; `sudo` prompts for a password that is **not** requested/exposed here):
```bash
sudo install -d -m 700 -o root -g root /opt/ooflowdesk/neolife
sudo install -m 600 -o root -g root /dev/null /opt/ooflowdesk/neolife/.env
sudo nano /opt/ooflowdesk/neolife/.env   # paste secret values, save, exit
```
- **What it changes:** creates the NEOLIFE secret file only.
- **What it does NOT change:** no existing service/config; no other files.
- **Can it affect an existing service?** No.

All Docker commands run as `ooadmin` **without** sudo (verified: `ooadmin` already has Docker access).

## 12. Cloudflare credential boundary
- **Do not paste the tunnel token into chat.** The Owner provisions it directly on the server:
  - Preferred: while editing the root `.env` (above), add `TUNNEL_TOKEN=...` there (0600, root-owned).
  - Or store as `/opt/ooflowdesk/secrets/neolife.env` (root-owned 0600) and `env_file` it.
- The token is never committed, logged, or displayed. The public-hostname ingress (`neolife.ooflowdesk.com` → `http://neolife-web:3000`) is set in the Cloudflare dashboard, not in this repo.

## 13. Owner decision points
1. **Cloudflare tunnel provisioning** — A) Owner creates a new dedicated tunnel + token for `neolife.ooflowdesk.com` (RECOMMENDED) · B) Owner confirms an existing tunnel is already dedicated to NEOLIFE and provides its token via the secure method · C) modify a shared tunnel (NOT approved) · D) alternative gateway (needs further review). **Kilo: A.** *Blocks:* §7 step 8.
2. **Production secrets provisioning** — A) Owner places secrets in the root `.env` themselves (RECOMMENDED) · B) Owner authorizes Kilo to write them (Kilo would still never display/log them). **Kilo: A.** *Blocks:* §7 steps 4/6/11.
3. **Deployment authorization** — the single explicit "go" to execute §7 steps 1–13. **Not yet given.**

## Final status
- §11.7 pre-flight: COMPLETE
- Deployment execution plan: IN PROGRESS (this document, pending Owner review)
- Production deployment: NOT AUTHORIZED
- Paid advertising: NOT AUTHORIZED



