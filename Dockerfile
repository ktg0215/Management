# Node.js 18 Alpine Linux ベースイメージを使用
FROM node:18-alpine

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY backend/package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションのソースコードをコピー
COPY backend/ .

# PostgreSQLクライアントをインストール（データベース操作用）
RUN apk add --no-cache postgresql-client

# ポート3001を公開
EXPOSE 3001

# アプリケーションを起動
CMD ["npm", "start"] 