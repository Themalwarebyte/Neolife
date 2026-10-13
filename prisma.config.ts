import { defineConfig } from "prisma/config";

/**
 * Optional shadow database (Task #029, Fix 6): set SHADOW_DATABASE_URL to an
 * EMPTY scratch local database NAME (e.g. "postgresql://localhost:5432/
 * neolife_shadow_check" — only the database NAME is taken from it) to run
 * the migrations↔schema drift check (`prisma migrate diff --from-migrations
 * … --to-schema …`), which requires a shadow datasource. Host and
 * credentials are taken from the MAIN datasource URL so the shadow
 * connection always matches the working one. Unset by default — normal
 * dev/production flows never need it. Never point it at a database holding
 * real data: migrations are replayed into it from scratch.
 */
function shadowDatabaseUrl(): string | undefined {
  const shadowRaw = process.env.SHADOW_DATABASE_URL;
  if (!shadowRaw) return undefined;
  const mainRaw = process.env.DATABASE_URL || "postgresql://localhost:5432/neolife";
  try {
    const main = new URL(mainRaw);
    const shadowName = decodeURIComponent(
      new URL(shadowRaw).pathname.replace(/^\//, ""),
    );
    if (!/^[A-Za-z0-9_-]+$/.test(shadowName)) return undefined;
    main.pathname = `/${shadowName}`;
    return main.toString();
  } catch {
    return undefined;
  }
}

const resolvedShadowUrl = shadowDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://localhost:5432/neolife",
    ...(resolvedShadowUrl ? { shadowDatabaseUrl: resolvedShadowUrl } : {}),
  },
});
