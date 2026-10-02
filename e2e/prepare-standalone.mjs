/**
 * E2E-only helper: make the Next.js standalone build complete enough to serve.
 *
 * `next build` emits `.next/standalone/` WITHOUT `.next/static/` or `public/`.
 * Next.js does not copy either into standalone output — the production
 * Dockerfile does it explicitly (see Dockerfile, `COPY --from=build
 * /app/.next/static ./.next/standalone/.next/static`). Running the standalone
 * server without those copies serves HTML but no client JavaScript or CSS, so
 * browser-driven Playwright specs fail in ways that look like application bugs.
 *
 * This script mirrors the Dockerfile so E2E exercises the same artifact that
 * production runs. It is idempotent, touches only the local `.next/` build
 * directory, and never contacts any remote service.
 *
 * Usage (normally invoked by playwright.config.ts webServer):
 *   node e2e/prepare-standalone.mjs
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import console from "node:console";
import process from "node:process";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = join(projectRoot, ".next");
const standaloneDir = join(nextDir, "standalone");
const serverEntry = join(standaloneDir, "server.js");

function fail(message) {
  console.error(`[prepare-standalone] ${message}`);
  process.exit(1);
}

if (!existsSync(serverEntry)) {
  fail(
    "No standalone build found at .next/standalone/server.js. Run `pnpm build` before the E2E suite.",
  );
}

/** Recursively copy `from` to `to`, creating the destination as needed. */
function copyInto(from, to) {
  if (!existsSync(from)) return false;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
  return true;
}

const copied = [];

if (copyInto(join(nextDir, "static"), join(standaloneDir, ".next", "static"))) {
  copied.push(".next/static");
}

if (copyInto(join(projectRoot, "public"), join(standaloneDir, "public"))) {
  copied.push("public");
}

if (copied.length === 0) {
  console.log("[prepare-standalone] Nothing to copy; standalone build already prepared.");
} else {
  console.log(`[prepare-standalone] Prepared standalone build: copied ${copied.join(", ")}.`);
}
