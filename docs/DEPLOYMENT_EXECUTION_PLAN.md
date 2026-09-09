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
The release commit is the commit that introduces `Dockerfile` + `.dockerignore` (first commit suitable for a production image build). The image tag is tied to that exact commit hash.

The `Dockerfile` is multi-stage and was **verified locally** (see §4a): it builds, serves `/health`, and runs `prisma migrate deploy` correctly.

- **build stage** `node:24-alpine`: `npm i -g pnpm@11.20.0` → copy `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` → `pnpm install --frozen-lockfile --fetch-timeout 180000 --fetch-retries 5` → `COPY . .` → `pnpm prisma generate` → `pnpm build` (→ `.next/standalone`).
- **runtime stage** `node:24-alpine`: copy `.next/standalone`, `.next/static`, `node_modules`, `prisma/` (migrations), `src/`, `scripts/`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `prisma.config.ts` → `ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0` → `CMD ["node", ".next/standalone/server.js"]`.
- `.dockerignore` excludes `node_modules`, `.next`, `.git`, `docs`, `.env*`, `src/generated`, test artifacts — so **no secrets and no local state enter the image**.
- A "full" image (source + node_modules + .next) is intentional so `prisma migrate deploy` and the admin seed run inside the container.

Deployment artifact steps (execution phase, after authorization):
1. (Local, Kilo) `docker build -t neolife-web:<RELEASE_SHA> .` — tag = release commit.
2. (Local, Kilo) `docker save neolife-web:<RELEASE_SHA> | gzip > neolife-web-<RELEASE_SHA>.tar.gz`
3. (Local→server, Kilo) `scp neolife-web-<RELEASE_SHA>.tar.gz ooflowdesk-remote:/home/ooadmin/`
4. (Server, Kilo as ooadmin) `docker load < /home/ooadmin/neolife-web-<RELEASE_SHA>.tar.gz`


## 2. Server filesystem (revised — no ooadmin-readable secrets)
```
/opt/ooflowdesk/neolife/
  compose.yaml          ooadmin:ooadmin  0644   (contains NO secrets)
  backups/              ooadmin:ooadmin  0700

/opt/ooflowdesk/secrets/
  neolife.env          root:root        0600   (production secrets — sudo, separate from existing secrets)
```
- `mkdir -p /opt/ooflowdesk/neolife/backups` — **non-sudo** (ooadmin owns `/opt/ooflowdesk`).
- `compose.yaml` and `backups/` — **non-sudo**, and contain **no secret values** (only `${VAR}` placeholders).
- `neolife.env` — **sudo**, root:root 0600, placed under the existing root-only `/opt/ooflowdesk/secrets/` **without touching existing files**.
- The compose file does **not** use `env_file:`, so `ooadmin` never needs to read the secret file to run `docker compose` for non-secret operations.

## 3. Docker compose.yaml design (additive; no host ports; dedicated network)
Canonical committed file: **`deploy/compose.yaml`** (secret-free; `${VAR}` placeholders only). Summary below (the `seed` service is profiled and does not run on `up -d`):

```yaml
name: neolife

services:
  web:
    image: neolife-web:<RELEASE_SHA>
    container_name: neolife-web
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: ${BETTER_AUTH_URL}
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

  # One-time admin seed — profiled, never runs on `up -d`.
  seed:
    image: neolife-web:3f535c5
    container_name: neolife-seed
    profiles: ["seed"]
    restart: "no"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: ${BETTER_AUTH_URL}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
    depends_on:
      db: { condition: service_healthy }
    networks: [neolife]
    command: ["pnpm", "exec", "tsx", "scripts/seed-admin.ts"]

networks:
  neolife:
    driver: bridge

volumes:
  neolife_pgdata:
```
- **No `ports:` mappings** → no host port published → no collision with occupied ports.
- **Dedicated `neolife` bridge** → no shared network with any existing application.
- **No `env_file:`** → secret values are injected only via `sudo docker compose --env-file /opt/ooflowdesk/secrets/neolife.env up -d` (§11); the compose file itself contains only `${VAR}` placeholders.
- `depends_on` is the only intra-project dependency; **no dependency on existing containers**.

## 4. PostgreSQL strategy
- Dedicated database `neolife`, user `neolife`, password from `POSTGRES_PASSWORD` (root `.env`), volume `neolife_pgdata`.
- In-container `DATABASE_URL` = `postgresql://neolife:<pw>@db:5432/neolife?schema=public` (service DNS `db` on the `neolife` network).
- Migration (Kilo, non-sudo, inside container): `docker compose run --rm web pnpm exec prisma migrate deploy`.
  - Forward-only; never `migrate dev`/`reset`/`db push`; never targets another application's database.
- Rollback: forward-only + redeploy previous image; **never drop the DB/volume**. Restore-from-backup only with explicit Owner authorization (destructive).

### 4a. Migration-image verification (DONE locally — NOT against production)
Verified with a disposable local `postgres:16-alpine` container and `neolife-web:test`:
- `docker run --rm --network <net> -e DATABASE_URL=... neolife-web:test pnpm exec prisma migrate deploy` → **all 5 migrations applied**.
- Resulting tables: `Lead`, `LeadEvent`, `Meeting`, `FollowUp`, `User`, `Session`, `Account`, `Verification`, `_prisma_migrations`.
- `neolife-web:test` also served `/health` → `{"status":"ok"}`.
- Disposable container/network were removed; production was never touched.

### 4b. Corrected database initialization sequence
Initial (new, empty) NEOLIFE database:
1. Create the dedicated DB (compose `up -d db`; Postgres creates `neolife` from `POSTGRES_DB`).
2. **Identity check** (§4c): confirm target is the NEOLIFE container/DB/user, never another app's DB.
3. Run the initial forward migration (`prisma migrate deploy`).
4. Verify schema (tables present).
5. Create the **first post-initialization backup** (`pg_dump`).

Future migrations: **backup → migration → verification** (take a backup before every migration).

### 4c. Pre-migration identity check (Kilo, read-only, no secrets printed)
```bash
docker ps --filter name=neolife-postgres --format '{{.Names}}'
docker exec neolife-postgres psql -U neolife -d neolife -tAc "select current_database(), current_user"
docker compose config | grep -E "container_name|image"   # confirms the neolife project only
```
Confirms: expected container (`neolife-postgres`), expected database (`neolife`), expected user (`neolife`), and that the connection target is the dedicated NEOLIFE DB. Passwords/connection strings are **never printed**.

## 5. Production environment (variable NAMES only — values never in Git/logs/chat)
`DATABASE_URL` · `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` (`https://neolife.ooflowdesk.com`) · `POSTGRES_PASSWORD` (compose DB) · `TUNNEL_TOKEN` (cloudflared, remotely-managed) · `ADMIN_EMAIL` · `ADMIN_PASSWORD` (one-time, consumed only by the profiled `seed` service — never the long-running `web` service, never on a CLI).
All live only in the root-owned `/opt/ooflowdesk/secrets/neolife.env` (0600). Never in `.env.example`, docs, commit messages, or terminal output.

## 6. Cloudflare
- `neolife.ooflowdesk.com` already resolves (A+AAAA). Whether a dedicated NEOLIFE tunnel already exists **cannot be verified without reading its credential/config**, which is prohibited.
- The Owner must **create a dedicated Cloudflare Tunnel + connector token** for `neolife.ooflowdesk.com` (Option A), and set its public-hostname ingress to origin `http://neolife-web:3000`.
- **Do NOT modify any existing shared tunnel** (Option C is NOT approved).
- The connector token lives **only** in the root-owned `neolife.env` as `TUNNEL_TOKEN` (§12); it is never displayed, committed, or pasted in chat.

## 7. Deployment ordering (safe sequence — NOT executed)
1. **Pre-deployment snapshot** (Kilo, read-only): `docker ps`, `docker network ls`, `ss -tlnp` — record existing state.
2. **Artifact/image prep** (Kilo, local): build + save + scp + `docker load` (§1).
3. **Directory** (Kilo, non-sudo): `mkdir -p /opt/ooflowdesk/neolife/backups`; place `compose.yaml` (no secrets).
4. **Secret file** (Owner, sudo): create root-owned `/opt/ooflowdesk/secrets/neolife.env` (§11).
5. **Dedicated DB + web + tunnel** (Owner, sudo): `sudo docker compose --env-file /opt/ooflowdesk/secrets/neolife.env up -d` — injects `POSTGRES_PASSWORD`, `DATABASE_URL`, `BETTER_AUTH_*`, `TUNNEL_TOKEN` into the containers; wait healthy.
6. **Migration** (Owner, sudo): `sudo docker compose --env-file /opt/ooflowdesk/secrets/neolife.env run --rm web pnpm exec prisma migrate deploy` — after the §4c identity check.
7. **Cloudflare route** (Owner, dashboard): `neolife.ooflowdesk.com` → `http://neolife-web:3000`.
8. **HTTPS verify** (Kilo, read-only): `curl -I https://neolife.ooflowdesk.com/health`.
9. **Health check** (Kilo, read-only): `https://neolife.ooflowdesk.com/health` → 200 `{"status":"ok"}`.
10. **Admin seed** (Owner, sudo): `sudo docker compose --profile seed --env-file /opt/ooflowdesk/secrets/neolife.env run --rm seed` — `ADMIN_EMAIL`/`ADMIN_PASSWORD` are injected from the secret file, never typed on the CLI.
11. **Application smoke tests** (Kilo): §9 (via the public HTTPS URL and `docker compose exec`).
12. **First post-init backup** (Kilo, non-sudo): `docker compose exec -T db pg_dump -U neolife neolife > backups/neolife-$(date +%F-%H%M%S).sql`.
13. **Existing-service health verification** (Kilo, read-only): re-run snapshot; confirm all existing containers unchanged/healthy.

## 8. Rollback strategy (non-destructive to existing apps)
- App rollback: `docker compose down web tunnel` then `docker compose up -d` with a previous `neolife-web:<tag>` image (keep `db` + `neolife_pgdata` intact).
- Migrations are forward-only; DB rollback via backup restore is **only** with Owner authorization and is never automated.
- NEOLIFE rollback never touches any existing service/network/volume.

## 9. Production smoke tests
`/` · `/campaign/launch` · `/register-interest` · `/privacy` · `/terms` · `/disclosures` · `/health` · `/admin/login` (200) · unauthenticated `/admin/leads` → 307 · lead submission → persisted in DB · attribution (UTM → first-touch → lead) · admin sign-in → `/admin/leads` · lead detail · status update · follow-up · meeting create/update · HTTPS (valid cert) · Cloudflare route serves the app.

## 10. Existing infrastructure — must remain untouched
ZongFitness (all containers/DB/network) · existing PostgreSQL databases · existing Docker networks · existing Caddy gateways · existing cloudflared tunnels · existing host ports · existing secrets (`/opt/ooflowdesk/secrets/`, `cloudflare-tunnel/`) · existing DNS/routes (except the specifically authorized `neolife.ooflowdesk.com`).

## 11. Sudo boundary (Owner executes personally)
Sudo is required for the **four secret-bearing operations** below (secrets live in the root-owned `neolife.env`). Owner copy-paste (run on the server as `ooadmin`; `sudo` prompts for a password that is **not** requested/exposed here):

```bash
# (1) Create the root-owned secret file
sudo install -d -m 700 -o root -g root /opt/ooflowdesk/neolife
sudo install -m 600 -o root -g root /dev/null /opt/ooflowdesk/secrets/neolife.env
sudo nano /opt/ooflowdesk/secrets/neolife.env      # paste DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, POSTGRES_PASSWORD, TUNNEL_TOKEN; save, exit

# (2) Launch the dedicated stack (injects secrets into containers)
cd /opt/ooflowdesk/neolife
sudo docker compose --env-file /opt/ooflowdesk/secrets/neolife.env up -d

# (3) Run migrations (after the §4c identity check)
sudo docker compose --env-file /opt/ooflowdesk/secrets/neolife.env run --rm web pnpm exec prisma migrate deploy

# (4) Seed the admin account (one-time; ADMIN_* come from the secret file, never typed on the CLI)
sudo docker compose --profile seed --env-file /opt/ooflowdesk/secrets/neolife.env run --rm seed
```
- **What each changes:** creates NEOLIFE-only secret file, containers, network, volume, database tables, and one admin user.
- **What it does NOT change:** no existing service/config/network/volume; no other files; does not touch `/opt/ooflowdesk/secrets/` existing files.
- **Can any affect an existing service?** No (dedicated `neolife` project/network only).

**Non-sudo (Kilo, as ooadmin):** image build/save/scp/load · `mkdir` + `compose.yaml` placement · `docker compose exec` (backups, smoke checks) · `docker ps`/`ss`/`curl` read-only checks · `docker compose restart/logs` (operates on already-running containers, does not re-read secrets).

## 12. Cloudflare credential boundary (unchanged principle)
- **Do not paste the tunnel token into chat.** The Owner adds `TUNNEL_TOKEN=...` directly to the root-owned `neolife.env` (§11), never in Git, logs, or terminal output.
- The public-hostname ingress (`neolife.ooflowdesk.com` → `http://neolife-web:3000`) is set in the Cloudflare dashboard, not in this repo.

## 13. Owner decision points
1. **Cloudflare tunnel provisioning** — A) Owner creates a new dedicated tunnel + token for `neolife.ooflowdesk.com` (RECOMMENDED) · B) Owner confirms an existing tunnel is already dedicated to NEOLIFE and provides its token via the secure method · C) modify a shared tunnel (NOT approved) · D) alternative gateway (needs further review). **Kilo: A.** *Blocks:* §7 step 7.
2. **Production secrets provisioning** — A) Owner places secrets in the root-owned `neolife.env` themselves and runs the secret-bearing sudo steps (RECOMMENDED) · B) Owner authorizes Kilo to write/run them (Kilo would still never display/log them). **Kilo: A.** *Blocks:* §7 steps 4/5/6/10.
3. **Deployment authorization** — the single explicit "go" to execute §7 steps 1–13. **Not yet given.**

## 14. Secret-handling approach comparison (chosen: §11 root-owned + sudo injection)

| | A) Root-owned `neolife.env` + Owner `sudo docker compose --env-file` (CHOSEN) | B) ooadmin-owned `.env` 0600 | C) Docker Swarm secrets |
|---|---|---|---|
| Security | Strong — file root:root 0600, ooadmin cannot read | Weaker — ooadmin-readable (reliance on Kilo discipline) | Strong — daemon-managed |
| Ownership/permissions | `root:root 0600` under `/opt/ooflowdesk/secrets/` | `ooadmin:ooadmin 0600` | managed by Swarm |
| Sudo required | Yes — file creation + every secret-bearing `up`/`run` | No | Yes — requires Swarm mode (adds complexity) |
| Exposed to ooadmin shell/process env? | Not in ooadmin's shell env; but inspectable in container metadata (`docker inspect`/`exec env`) — true of any Docker-based scheme while ooadmin has Docker access | Yes (file readable) | No (Swarm-managed) |
| Docker Compose can consume it? | Yes (`--env-file` interpolation) | Yes (`env_file`) | Yes (Swarm only) |
| Operational | Heavier — Owner runs secret-bearing deploys; Kilo does non-secret ops | Lighter — Kilo self-serve, but weaker | Heaviest — Swarm migration |

**Recommendation: A** (Owner decision, accepted). Accurate wording:

> The secret source file is root-only. Because the existing `ooadmin` account has root-equivalent Docker privileges, secrets injected into container environments are technically inspectable by that account. NEOLIFE does not modify this existing server privilege model. Kilo must not intentionally inspect, print, log, or expose secret values.

The root-only `neolife.env` protects the **source file**; it does **not** hide container-environment values from a Docker-privileged account. NEOLIFE leaves the existing `ooadmin` privilege model unchanged.

## Final status
- §11.7 pre-flight: COMPLETE
- Deployment execution plan: REVISED / AWAITING OWNER REVIEW
- Production deployment: NOT AUTHORIZED
- Paid advertising: NOT AUTHORIZED




