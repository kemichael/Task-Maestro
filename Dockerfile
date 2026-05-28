# syntax=docker/dockerfile:1.7
# 本番用イメージ (Next.js standalone output + better-sqlite3 ネイティブビルド込み)

ARG NODE_VERSION=20-bookworm-slim

# ============================================================
# Stage 1: 依存解決 (本番 + devDependencies のフルセット)
# ============================================================
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# better-sqlite3 のネイティブビルドに必要
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ============================================================
# Stage 2: ビルド (Next.js standalone)
# ============================================================
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ============================================================
# Stage 3: 実行 (最小限のランタイム)
# ============================================================
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root ユーザで起動
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# standalone output と静的アセット、マイグレーションをコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations

# データディレクトリ (volume マウント先)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
