# Docker環境での実行方法

## 必要なソフトウェア

1. **Docker Desktop for Windows**
   - [Docker公式サイト](https://www.docker.com/products/docker-desktop/)からダウンロードしてインストール
   - WSL 2バックエンドを有効にする（推奨）
   - インストール後、システムを再起動

## セットアップ手順

### 1. 環境変数の設定
```bash
# docker.envファイルを.envにコピー
copy docker.env .env
```

### 2. Docker環境の起動
```bash
# すべてのサービスをバックグラウンドで起動
docker-compose up -d

# ログを確認（オプション）
docker-compose logs -f
```

### 3. データベースの初期化
```bash
# データベースマイグレーション実行
docker-compose exec backend npm run migrate

# デモデータの投入（オプション）
docker-compose exec backend node setup-and-insert-data.js
```

## 主要なコマンド

### サービス管理
```bash
# すべてのサービスを起動
docker-compose up

# バックグラウンドで起動
docker-compose up -d

# 特定のサービスのみ起動
docker-compose up postgres backend

# サービスを停止
docker-compose down

# サービスを停止してボリュームも削除
docker-compose down -v
```

### ログの確認
```bash
# すべてのサービスのログを表示
docker-compose logs

# 特定のサービスのログを表示
docker-compose logs backend
docker-compose logs frontend

# リアルタイムでログを監視
docker-compose logs -f
```

### コンテナ内でのコマンド実行
```bash
# バックエンドコンテナでコマンド実行
docker-compose exec backend npm install
docker-compose exec backend node check_db.js

# データベースコンテナに接続
docker-compose exec postgres psql -U postgres -d shift_management

# フロントエンドの依存関係をインストール
docker-compose exec frontend npm install
```

### 開発中の変更の反映
```bash
# サービスを再構築
docker-compose build

# 特定のサービスのみ再構築
docker-compose build backend

# キャッシュを使わずに再構築
docker-compose build --no-cache
```

## アクセス方法

- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:3001
- **Nginxプロキシ**: http://localhost:80
- **PostgreSQL**: localhost:5432

## トラブルシューティング

### よくある問題

1. **ポートが既に使用されている**
   ```bash
   # 使用中のポートを確認
   netstat -ano | findstr :3000
   netstat -ano | findstr :3001
   netstat -ano | findstr :5432
   ```

2. **コンテナが起動しない**
   ```bash
   # サービスの状態を確認
   docker-compose ps
   
   # エラーログを確認
   docker-compose logs [service-name]
   ```

3. **データベース接続エラー**
   ```bash
   # PostgreSQLサービスの状態確認
   docker-compose exec postgres pg_isready -U postgres
   
   # データベース接続テスト
   docker-compose exec backend node check_db.js
   ```

4. **権限エラー（Windows）**
   - Docker Desktopを管理者として実行
   - WSL 2が正しく設定されているか確認

### コンテナとボリュームのクリーンアップ
```bash
# 停止したコンテナを削除
docker container prune

# 使用していないイメージを削除
docker image prune

# 使用していないボリュームを削除
docker volume prune

# すべてを一括削除（注意！）
docker system prune -a --volumes
```

## 開発のワークフロー

1. **初回セットアップ**
   ```bash
   docker-compose up -d
   docker-compose exec backend npm run migrate
   docker-compose exec backend node setup-and-insert-data.js
   ```

2. **日常の開発**
   ```bash
   # 環境を起動
   docker-compose up -d
   
   # 開発中...
   
   # 変更を反映
   docker-compose restart backend  # バックエンドのみ
   docker-compose restart frontend # フロントエンドのみ
   ```

3. **クリーンアップ**
   ```bash
   docker-compose down
   docker volume prune  # データベースデータも削除する場合
   ```

## セキュリティ注意事項

- 本番環境では`docker.env`ファイルの認証情報を適切に変更してください
- PostgreSQLのパスワードは強力なものに変更してください
- JWT_SECRETとSESSION_SECRETは十分に長いランダムな文字列を使用してください 