# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS builder

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /workspace

RUN corepack enable \
    && corepack prepare pnpm@10.11.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile --filter @tamnalog/web...

COPY web ./web
COPY packages ./packages

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_API_PROXY_PATH
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_KAKAO_MAP_KEY

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_API_PROXY_PATH=${NEXT_PUBLIC_API_PROXY_PATH} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_KAKAO_MAP_KEY=${NEXT_PUBLIC_KAKAO_MAP_KEY}

RUN --mount=type=secret,id=sentry_auth_token,required=false \
    export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    && mkdir -p web/public \
    && pnpm --filter @tamnalog/web build

FROM node:22-alpine AS runner

WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_API_PROXY_PATH
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_KAKAO_MAP_KEY

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_API_PROXY_PATH=${NEXT_PUBLIC_API_PROXY_PATH} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_KAKAO_MAP_KEY=${NEXT_PUBLIC_KAKAO_MAP_KEY}

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/web/.next/static ./web/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/web/public ./web/public

USER nextjs

EXPOSE 3000

CMD ["node", "web/server.js"]
