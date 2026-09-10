/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy notes:
// - 'unsafe-inline' for scripts/styles is required by Next.js App Router inline
//   bootstrap scripts and by Tailwind/inline style attributes.
// - 'unsafe-eval' is only needed in development (Turbopack HMR); omitted in
//   production to keep the CSP meaningful.
// - connect-src 'self' restricts all network calls (login/sign-out fetch) to
//   same-origin — consistent with the first-party-only tracking decision (D-013).
const scriptSrc = `'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;

const nextConfig = {
  output: "standalone",
  // Landing photography is self-hosted and pre-optimized WebP; serve it directly
  // to avoid a native `sharp` dependency (and its alpine platform binaries) in the
  // standalone image. next/image still provides lazy-loading and layout stability.
  images: {
    unoptimized: true,
  },
  // Better Auth (and its runtime deps) use Node builtins (e.g. node:module) that
  // Turbopack cannot bundle for Server Actions; keep them external at runtime.
  serverExternalPackages: [
    "better-auth",
    "@better-auth/core",
    "@better-auth/prisma-adapter",
    "better-call",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
