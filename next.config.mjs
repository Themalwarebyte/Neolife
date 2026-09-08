/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Better Auth (and its runtime deps) use Node builtins (e.g. node:module) that
  // Turbopack cannot bundle for Server Actions; keep them external at runtime.
  serverExternalPackages: [
    "better-auth",
    "@better-auth/core",
    "@better-auth/prisma-adapter",
    "better-call",
  ],
};

export default nextConfig;
