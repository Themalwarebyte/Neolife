# AGENTS.md — NEOLIFE

## Development commands

| Task | Command |
|------|---------|
| Lint | `npx eslint . --max-warnings 0` |
| Type-check | `npx tsc --noEmit` |
| Unit + DB tests | `npx vitest run` |
| E2E tests | `npx playwright test` (requires server + PostgreSQL) |
| Dev server | `npm run dev` — `http://localhost:3000` |
| Production build | `npx next build` |
| Start production | `node .next/standalone/server.js` |
| Prisma generate | `npx prisma generate` |
| Prisma migrate | `npx prisma migrate dev` |

## Architecture notes

- **Test runner:** Vitest (not Jest). Test files in `tests/` and `e2e/`.
- **E2E runner:** Playwright with system Chrome (`channel: "chrome"` in `playwright.config.ts`).
- **Project type:** `"type": "module"` — use `import/export`, not `require()`.
- **Aliases:** `@/` maps to `src/` (configured in both `tsconfig.json` and `vitest.config.ts`).
- **Database:** PostgreSQL via Prisma. Local dev uses `docker compose up -d`.
- **Auth:** Better Auth 1.7.2 with `@/lib/auth.ts`. Server-side session checks via `src/server/auth/requireCrmUser.ts`.
- **Server Actions:** Marked `"use server"`. Use `await requireAdmin()` / `await requireCrmUser()` for auth guards.

## CI / pre-commit checklist

1. `npx tsc --noEmit` — must pass
2. `npx eslint . --max-warnings 0` — must pass
3. `npx vitest run` — all non-DB tests must pass; DB tests skip without PostgreSQL
