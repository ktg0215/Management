#!/bin/bash

# セキュリティ設定用スクリプト
echo "🔐 セキュリティ設定を初期化しています..."

# secretsディレクトリを作成
mkdir -p secrets
mkdir -p data/postgres
mkdir -p logs/backend
mkdir -p logs/nginx

# パスワードファイルが存在しない場合のみ作成
if [ ! -f "secrets/postgres_password.txt" ]; then
    echo "📝 PostgreSQLパスワードを生成中..."
    # 強力なランダムパスワードを生成
    openssl rand -base64 32 > secrets/postgres_password.txt
    echo "✅ PostgreSQLパスワードが生成されました"
else
    echo "ℹ️  PostgreSQLパスワードは既に存在します"
fi

if [ ! -f "secrets/jwt_secret.txt" ]; then
    echo "📝 JWTシークレットを生成中..."
    # JWT用の強力なシークレットを生成
    openssl rand -hex 64 > secrets/jwt_secret.txt
    echo "✅ JWTシークレットが生成されました"
else
    echo "ℹ️  JWTシークレットは既に存在します"
fi

# ファイルのパーミッションを設定
chmod 600 secrets/*.txt
chmod 700 secrets/

# .env.exampleファイルを作成
cat > .env.example << 'EOF'
# 開発環境用の設定例
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=shift_management
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT設定
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# フロントエンド設定
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF

# .gitignore にsecretsディレクトリを追加
if ! grep -q "secrets/" .gitignore 2>/dev/null; then
    echo -e "\n# Docker secrets\nsecrets/\ndata/\nlogs/" >> .gitignore
    echo "📝 .gitignoreにsecretsディレクトリを追加しました"
fi

echo ""
echo "🎉 セキュリティ設定が完了しました！"
echo ""
echo "📋 次の手順:"
echo "   1. secrets/postgres_password.txt でデータベースパスワードを確認"
echo "   2. secrets/jwt_secret.txt でJWTシークレットを確認" 
echo "   3. docker-compose up -d でコンテナを起動"
echo ""
echo "⚠️  重要: secretsディレクトリは絶対にGitにコミットしないでください"