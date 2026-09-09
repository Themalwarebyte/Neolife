# NEOLIFE — Changelog

## Unreleased — §11.7 deployment preparation

- Added `Dockerfile` (multi-stage, standalone runtime + Prisma migration/seed support) and `.dockerignore`.
- Verified locally: image builds; `prisma migrate deploy` applies all migrations against a disposable PostgreSQL (tables: Lead, LeadEvent, Meeting, FollowUp, User, Session, Account, Verification, _prisma_migrations); image serves `/health` → `{"status":"ok"}`.
- Authored `docs/DEPLOYMENT_EXECUTION_PLAN.md` (isolated additive deployment; dedicated `neolife` network/DB/tunnel; no host ports; no shared resources).
- Redesigned production secret handling (root-owned secret file injected via `sudo docker compose --env-file`, `${VAR}` interpolation only).

### Release commit
This release is the commit that introduces the `Dockerfile` + `.dockerignore` (the first commit suitable for building the production image). The image tag is tied to that commit hash.
