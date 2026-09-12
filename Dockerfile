# NEOLIFE Traffic MVP production image.
# Build stage compiles the app and generates the Prisma client;
# runtime stage carries everything needed to (a) serve the standalone app and
# (b) run `prisma migrate deploy` and the admin seed inside the container.

FROM node:24-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.20.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --fetch-timeout 180000 --fetch-retries 5
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm prisma generate && pnpm build

FROM node:24-alpine AS runtime
WORKDIR /app
RUN npm install -g pnpm@11.20.0
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
# Runtime app
COPY --from=build /app/.next/standalone ./.next/standalone
COPY --from=build /app/.next/static ./.next/standalone/.next/static
# Self-hosted public assets (images/images/landing etc.) — Next standalone output
# does not copy public/ automatically, so include it explicitly.
COPY --from=build /app/public ./.next/standalone/public
# Migration / seed support
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/prisma.config.ts ./
# tsconfig.json is required by tsx to resolve the "@/*" path aliases used by the
# admin seed (src/lib/auth.ts -> @/server/db/prisma -> @/generated/prisma/client).
COPY --from=build /app/tsconfig.json ./
EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
