# NEOLIFE — Deployment Runbook & Production Environment Specification

> **STATUS: ?? PRODUCTION IS LIVE** at **https://neolife.ooflowdesk.com**.
> Current production baseline (verified 2026-10-21):
> - Application commit: **9dfbf16**
> - Production image: **neolife-web:9dfbf16**
> - Release: **SUCCESS**
> - PostgreSQL: healthy; Cloudflare Tunnel: running
> - Prisma migrations: **17 applied** (none pending). No Phase 28 schema migration required.
> - Phase 28A/B: implemented, tested, deployed and Owner-accepted (417/417 passing; 12/12 checks)
> - Backup retained; rollback not needed. Previous image retained.

(This document retains historical deployment details below for traceability.)
