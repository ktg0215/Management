#!/bin/bash
# deploy-to-vps.sh
# ローカル環境をVPSに完全同期するスクリプト
# 使用方法: ./deploy-to-vps.sh [--with-db] [--db-only]

set -e

# 設定
VPS_HOST="ktg@160.251.207.87"
VPS_APP_DIR="/home/ktg/apps/project"
LOCAL_PROJECT_DIR="/c/job/project"

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# オプション解析
SYNC_DB=false
DB_ONLY=false

for arg in "$@"; do
    case $arg in
        --with-db)
            SYNC_DB=true
            ;;
        --db-only)
            DB_ONLY=true
            SYNC_DB=true
            ;;
    esac
done

# データベース同期関数
sync_database() {
    echo_info "=========================================="
    echo_info "データベース同期を開始..."
    echo_info "=========================================="

    # ローカルDBをダンプ
    echo_info "ローカルデータベースをエクスポート中..."
    PGPASSWORD=postgres123 pg_dump -h localhost -p 5433 -U postgres \
        --clean --if-exists --no-owner --no-privileges \
        shift_management > /tmp/local_db_dump.sql

    if [ ! -s /tmp/local_db_dump.sql ]; then
        echo_error "データベースダンプが空です"
        exit 1
    fi

    DUMP_SIZE=$(ls -lh /tmp/local_db_dump.sql | awk '{print $5}')
    echo_info "ダンプファイルサイズ: $DUMP_SIZE"

    # VPSに転送してインポート
    echo_info "VPSにデータベースを転送・インポート中..."
    scp /tmp/local_db_dump.sql $VPS_HOST:/tmp/
    ssh $VPS_HOST "PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d shift_management -f /tmp/local_db_dump.sql && rm /tmp/local_db_dump.sql"

    # ローカルのダンプファイル削除
    rm /tmp/local_db_dump.sql

    echo_info "データベース同期完了！"
}

# DBのみモードの場合
if [ "$DB_ONLY" = true ]; then
    sync_database
    echo_info "=========================================="
    echo_info "データベースのみの同期が完了しました"
    echo_info "=========================================="
    exit 0
fi

echo_info "=========================================="
echo_info "VPSデプロイを開始します"
echo_info "=========================================="

# Step 1: フロントエンドビルド
echo_info "Step 1: フロントエンドをビルド中..."
cd "$LOCAL_PROJECT_DIR/next-app"
npm run build

if [ ! -d ".next/standalone" ]; then
    echo_error "standaloneビルドが見つかりません"
    exit 1
fi

# Step 2: standalone用のファイルをコピー（重要！）
echo_info "Step 2: standaloneに必要なファイルをコピー中..."
cp -r public .next/standalone/next-app/
cp -r .next/static .next/standalone/next-app/.next/

echo_info "standaloneの内容を確認:"
ls -la .next/standalone/next-app/

# Step 3: フロントエンドをVPSに転送
echo_info "Step 3: フロントエンドをVPSに転送中..."
scp -r .next/standalone $VPS_HOST:$VPS_APP_DIR/next-app/.next/

# Step 4: バックエンドを転送
echo_info "Step 4: バックエンドをVPSに転送中..."
cd "$LOCAL_PROJECT_DIR/backend"
rsync -avz --exclude 'node_modules' --exclude '.env' \
    ./ $VPS_HOST:$VPS_APP_DIR/backend/

# Step 5: VPSで依存関係インストールとPM2再起動
echo_info "Step 5: VPSでサービスを再起動中..."
ssh $VPS_HOST << 'EOF'
    cd /home/ktg/apps/project/backend
    npm install --production

    cd /home/ktg/apps/project/next-app

    # standaloneのファイル確認
    echo "Checking standalone files..."
    ls -la .next/standalone/next-app/public/ | head -5

    # PM2再起動
    pm2 restart management-frontend management-backend

    # ステータス確認
    echo ""
    echo "PM2 Status:"
    pm2 status
EOF

# Step 6: データベース同期（オプション）
if [ "$SYNC_DB" = true ]; then
    sync_database
fi

# Step 7: 動作確認
echo_info "Step 7: 動作確認中..."
sleep 3

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.because-i-love-you.com/bb/)
if [ "$HTTP_STATUS" = "200" ]; then
    echo_info "フロントエンド: OK (HTTP $HTTP_STATUS)"
else
    echo_warn "フロントエンド: HTTP $HTTP_STATUS"
fi

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.because-i-love-you.com/api/health)
if [ "$API_STATUS" = "200" ]; then
    echo_info "バックエンドAPI: OK (HTTP $API_STATUS)"
else
    echo_warn "バックエンドAPI: HTTP $API_STATUS"
fi

echo_info "=========================================="
echo_info "デプロイ完了！"
echo_info "=========================================="
echo ""
echo "確認URL:"
echo "  - フロントエンド: https://www.because-i-love-you.com/bb/"
echo "  - API: https://www.because-i-love-you.com/api/health"
echo ""
if [ "$SYNC_DB" = false ]; then
    echo_warn "データベースは同期されていません"
    echo "データベースも同期する場合: ./deploy-to-vps.sh --with-db"
fi
