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
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_KAKAO_MAP_KEY
# 심사위원용 모드 진입 코드. NEXT_PUBLIC_*은 next build가 번들에 인라인하므로
# **builder 스테이지에 반드시 있어야 한다** — 런타임 env만 주면 값이 들어가지 않는다.
# 비어 있어도 빌드는 통과하고, 그때는 어떤 코드로도 모드가 열리지 않는다(env.ts는 optional).
ARG NEXT_PUBLIC_JUDGE_MODE_CODE

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_KAKAO_MAP_KEY=${NEXT_PUBLIC_KAKAO_MAP_KEY} \
    NEXT_PUBLIC_JUDGE_MODE_CODE=${NEXT_PUBLIC_JUDGE_MODE_CODE}

RUN --mount=type=secret,id=sentry_auth_token,required=false \
    export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    && mkdir -p web/public \
    && pnpm --filter @tamnalog/web build

FROM node:22-alpine AS runner

WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_KAKAO_MAP_KEY
# 심사위원용 모드 진입 코드. NEXT_PUBLIC_*은 next build가 번들에 인라인하므로
# **builder 스테이지에 반드시 있어야 한다** — 런타임 env만 주면 값이 들어가지 않는다.
# 비어 있어도 빌드는 통과하고, 그때는 어떤 코드로도 모드가 열리지 않는다(env.ts는 optional).
ARG NEXT_PUBLIC_JUDGE_MODE_CODE

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_KAKAO_MAP_KEY=${NEXT_PUBLIC_KAKAO_MAP_KEY} \
    NEXT_PUBLIC_JUDGE_MODE_CODE=${NEXT_PUBLIC_JUDGE_MODE_CODE}

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/web/.next/static ./web/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/web/public ./web/public

USER nextjs

EXPOSE 3000

CMD ["node", "web/server.js"]
