#!/bin/bash

# ConoHa VPS デプロイスクリプト
# 使用方法: ./deploy.sh [init|update|restart|logs|backup]

set -e

# 設定（適宜変更してください）
VPS_IP="160.251.207.87"
VPS_USER="ktg"
APP_DIR="/home/ktg/apps/project"
BACKUP_DIR="/home/ktg/backups"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ヘルパー関数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# SSH接続テスト
test_connection() {
    log_info "VPSへの接続をテスト中..."
    if ssh -o ConnectTimeout=5 ${VPS_USER}@${VPS_IP} "echo 'Connection successful'" > /dev/null 2>&1; then
        log_info "接続成功"
        return 0
    else
        log_error "VPSへの接続に失敗しました"
        log_error "以下を確認してください:"
        log_error "  1. VPS_IP と VPS_USER が正しいか"
        log_error "  2. SSH公開鍵が登録されているか"
        log_error "  3. ファイアウォールが接続を許可しているか"
        exit 1
    fi
}

# 初回デプロイ
init_deploy() {
    log_info "初回デプロイを開始します..."
    test_connection

    log_info "プロジェクトディレクトリを作成中..."
    ssh ${VPS_USER}@${VPS_IP} "mkdir -p ${APP_DIR} ${BACKUP_DIR}/database"

    log_info "プロジェクトファイルをアップロード中..."
    rsync -avz --progress \
        --exclude 'node_modules' \
        --exclude '.next' \
        --exclude '.env' \
        --exclude '.env.local' \
        --exclude 'logs' \
        --exclude '.git' \
        --exclude 'verification-screenshots' \
        --exclude 'all-pages-screenshots' \
        --exclude 'test*.png' \
        --exclude '*.json' \
        ./ ${VPS_USER}@${VPS_IP}:${APP_DIR}/

    log_info "依存関係をインストール中..."
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
        cd /home/deploy/apps/project/backend
        npm install --production

        cd /home/deploy/apps/project/next-app
        npm install --production
        npm run build
ENDSSH

    log_warn "次のステップ:"
    log_warn "  1. VPSにSSHでログイン: ssh ${VPS_USER}@${VPS_IP}"
    log_warn "  2. 環境変数を設定: nano ${APP_DIR}/backend/.env"
    log_warn "  3. 環境変数を設定: nano ${APP_DIR}/next-app/.env.local"
    log_warn "  4. データベースマイグレーションを実行"
    log_warn "  5. PM2でアプリを起動: cd ${APP_DIR} && pm2 start ecosystem.config.js"
    log_info "初回デプロイ完了"
}

# 更新デプロイ
update_deploy() {
    log_info "アプリケーションを更新します..."
    test_connection

    log_info "プロジェクトファイルを同期中..."
    rsync -avz --progress \
        --exclude 'node_modules' \
        --exclude '.next' \
        --exclude '.env' \
        --exclude '.env.local' \
        --exclude 'logs' \
        --exclude '.git' \
        --exclude 'verification-screenshots' \
        --exclude 'all-pages-screenshots' \
        --exclude 'test*.png' \
        --exclude '*.json' \
        ./ ${VPS_USER}@${VPS_IP}:${APP_DIR}/

    log_info "依存関係を更新中..."
    ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
        cd /home/deploy/apps/project/backend
        npm install --production

        cd /home/deploy/apps/project/next-app
        npm install --production
        npm run build
ENDSSH

    log_info "アプリケーションを再起動中..."
    ssh ${VPS_USER}@${VPS_IP} "cd ${APP_DIR} && pm2 restart all"

    log_info "更新完了"
}

# アプリケーション再起動
restart_app() {
    log_info "アプリケーションを再起動中..."
    test_connection

    ssh ${VPS_USER}@${VPS_IP} "cd ${APP_DIR} && pm2 restart all"

    log_info "再起動完了"
}

# ログ表示
show_logs() {
    log_info "ログを表示中..."
    test_connection

    ssh ${VPS_USER}@${VPS_IP} "cd ${APP_DIR} && pm2 logs --lines 100"
}

# データベースバックアップ
backup_database() {
    log_info "データベースバックアップを作成中..."
    test_connection

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="management_system_${TIMESTAMP}.sql"

    ssh ${VPS_USER}@${VPS_IP} << ENDSSH
        pg_dump -h localhost -U deploy_user management_system > ${BACKUP_DIR}/database/${BACKUP_FILE}
        gzip ${BACKUP_DIR}/database/${BACKUP_FILE}
ENDSSH

    log_info "バックアップ完了: ${BACKUP_FILE}.gz"

    # ローカルにダウンロード
    log_info "バックアップをローカルにダウンロード中..."
    mkdir -p ./backups
    scp ${VPS_USER}@${VPS_IP}:${BACKUP_DIR}/database/${BACKUP_FILE}.gz ./backups/

    log_info "バックアップは ./backups/${BACKUP_FILE}.gz に保存されました"
}

# ヘルプメッセージ
show_help() {
    echo "使用方法: ./deploy.sh [command]"
    echo ""
    echo "利用可能なコマンド:"
    echo "  init      - 初回デプロイ（ファイルアップロード、依存関係インストール）"
    echo "  update    - 更新デプロイ（ファイル同期、ビルド、再起動）"
    echo "  restart   - アプリケーション再起動"
    echo "  logs      - ログ表示"
    echo "  backup    - データベースバックアップ"
    echo "  help      - このヘルプを表示"
    echo ""
    echo "例:"
    echo "  ./deploy.sh init       # 初回デプロイ"
    echo "  ./deploy.sh update     # アプリ更新"
    echo "  ./deploy.sh backup     # DBバックアップ"
}

# メイン処理
case "$1" in
    init)
        init_deploy
        ;;
    update)
        update_deploy
        ;;
    restart)
        restart_app
        ;;
    logs)
        show_logs
        ;;
    backup)
        backup_database
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        log_error "不明なコマンド: $1"
        show_help
        exit 1
        ;;
esac
