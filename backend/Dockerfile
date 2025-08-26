# マルチステージビルドでセキュリティ向上
FROM node:18-alpine as builder

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（devDependenciesも含む）
RUN npm ci

# アプリケーションのソースコードをコピー
COPY . .

# TypeScriptのビルド（もしあれば）
RUN npm run build || echo "No build script found"

# プロダクション用のイメージ
FROM node:18-alpine as runtime

# セキュリティアップデートを適用
RUN apk update && apk upgrade && apk add --no-cache \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# 非rootユーザーを作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# 作業ディレクトリを設定
WORKDIR /app

# 所有者を設定
RUN chown -R nodejs:nodejs /app

# builderステージから必要なファイルをコピー
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nodejs:nodejs /app/database ./database

# プロダクション用依存関係のみインストール
RUN npm ci --only=production && npm cache clean --force

# 非rootユーザーに切り替え
USER nodejs

# ポート3001を公開
EXPOSE 3001

# ヘルスチェックを追加
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    http.get('http://localhost:3001/api/health', (res) => { \
      process.exit(res.statusCode === 200 ? 0 : 1); \
    }).on('error', () => process.exit(1));"

# アプリケーションを起動
CMD ["npm", "start"]