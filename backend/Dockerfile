# ---- base: Node + pnpm (via corepack) + openssl, which Prisma's migration engine needs ----
FROM node:24-alpine AS base
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

# ---- deps: install everything (dev deps are needed to compile TypeScript) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma.config.ts reads DATABASE_URL; `prisma generate` doesn't connect, so a placeholder is fine
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm install --frozen-lockfile

# ---- migrate: one-shot image that applies Prisma migrations (has the prisma CLI, a dev dependency) ----
FROM deps AS migrate
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# ---- build: compile to dist/, then drop dev dependencies ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod --ignore-scripts

# ---- runner (default target): only what production needs, running as the unprivileged `node` user ----
FROM base AS runner
ENV NODE_ENV=production
RUN mkdir -p /app/uploads && chown node:node /app/uploads
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# The evaluation dataset, so `node dist/scripts/eval.js` works inside the container
COPY --chown=node:node eval/dataset.json ./eval/dataset.json
USER node
EXPOSE 8080
# The same image runs the API (default) and the worker (`node dist/worker.js`, see docker-compose.yml)
CMD ["node", "dist/server.js"]
