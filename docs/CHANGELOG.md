# NEOLIFE — Changelog

## Unreleased — §11.7 deployment preparation

- Added `Dockerfile` (multi-stage, standalone runtime + Prisma migration/seed support) and `.dockerignore`.
- Verified locally: image builds; `prisma migrate deploy` applies all migrations against a disposable PostgreSQL; image serves `/health`.
- Added `deploy/compose.yaml` — canonical production Compose (secret-free `${VAR}` placeholders): `web`, `db`, `tunnel`, and a **profiled `seed` service** so `ADMIN_EMAIL`/`ADMIN_PASSWORD` are injected from the secret file (never typed on a CLI). Dedicated `neolife` project/network/volume; no host ports; no shared resources.
- Authored `docs/DEPLOYMENT_EXECUTION_PLAN.md` (isolated additive deployment; root-owned secret file + `sudo docker compose --env-file` injection; corrected DB/migration/backup sequence).
- Redesigned production secret handling (root-owned `/opt/ooflowdesk/secrets/neolife.env`, `${VAR}` interpolation only).

### Release commit
The production image is tied to commit `3f535c5e565d6f3dd35848b4eb3595f9ee482ef7` (the Dockerfile commit). The deploy Compose file (`deploy/compose.yaml`) is added in a subsequent commit; it references `neolife-web:3f535c5`.

