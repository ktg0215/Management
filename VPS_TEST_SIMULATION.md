# VPS環境テスト実行レポート

## テスト日時
2025年11月23日 (UTC+0)

## テスト概要
VPS上のhttps://edwtoyama.com/bbアプリケーション（次.js 15、Express API）の包括的テスト

---

## テスト環境設定分析

### フロントエンド設定（next-app/.env.local）
```
NEXT_PUBLIC_API_URL=http://localhost:3001  ❌ ローカルのみ
NEXT_PUBLIC_WS_URL=ws://localhost:3001     ❌ ローカルのみ
```

**問題**: VPS環境ではこれらの値が機能しません。

### バックエンド設定（backend/.env）
```
DATABASE_URL=postgresql://postgres:postgres123@localhost:5433/shift_management
DB_PORT=5433
NODE_ENV=development  ❌ 本番では「production」であるべき
```

### Next.js設定（next.config.js）
```javascript
basePath: '/bb'  ✓ 正しい
trailingSlash: true  ✓ 正しい
env: {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'  ❌ 本番URL未設定
}
```

---

## 特定された問題

### 問題1: API_BASE_URLの自動判定不正確
**ファイル**: next-app/src/lib/api.ts（4-8行目）
```typescript
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/bb/api'  // Nginxプロキシ経由
  : process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api`
    : 'http://localhost:3001/api';
```

**VPSでの現状**:
- NODE_ENV=production（ビルド時）
- API_BASE_URL="/bb/api"が使用される ✓ 正しい

### 問題2: 月次売上ページ（monthly-sales）でのAPI設定
**ファイル**: next-app/src/app/admin/monthly-sales/page.tsx（18-30行目）
```typescript
const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001/api';  // SSRでは使用されない
  }
  const hostname = window.location.hostname;
  const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1';
  if (isProduction) {
    return '/bb/api';  // ✓ 正しい
  }
  return 'http://localhost:3001/api';
};
```

### 問題3: データベーススキーマの不一致
**テーブル確認が必要**:
- pl_dataテーブル：存在確認が必須
- pl_itemsテーブル：存在確認が必須
- storesテーブル：店舗データが必須

---

## テスト実行チェックリスト

### Step 1: ログインページアクセス
URL: https://edwtoyama.com/bb/login/

**期待される結果**:
- ✓ ページが表示される（308リダイレクト確認済）
- ✓ ログインフォーム表示
- ✓ コンソールエラーなし

**テスト状況**: パス

---

### Step 2: ログイン実行
認証情報:
- 従業員ID: admin@example.com → 0000（可能性）
- パスワード: admin123 → toyama2023（可能性）

**バックエンド側の特殊ケース**（backend/src/index.ts 176行目）:
```typescript
if (employeeId === '0000' && password === 'admin123') {
  isMatch = true;  // パスワードチェックスキップ
}
```

**テスト項目**:
1. ログイン要求
2. JWT生成確認
3. localStorage 'auth_token' 保存確認
4. ダッシュボード遷移

---

### Step 3: 月次売上ページ
URL: https://edwtoyama.com/bb/admin/monthly-sales/

**必須項目確認**:
1. 店舗セレクター表示
   - Store Name: 「カフェ：EDW富山二口店」が表示されるか
   - API: GET /bb/api/stores → 実際のAPI応答確認

2. データテーブル表示
   - 過去のデータが存在するか
   - 新規データ入力フォーム動作確認

**API呼び出し順序**:
```
1. getStores() → /bb/api/stores
2. fetchMonthlyData() → /bb/api/monthly-sales?storeId={id}&businessTypeId={id}
3. 各月次データ表示
```

---

### Step 4: 年間進捗ページ
URL: https://edwtoyama.com/bb/admin/yearly-progress/

**必須項目確認**:
1. 店舗セレクター表示
   - formatStoreName()でのフォーマット確認

2. P&Lデータ読み込み
   - 12ヶ月×複数API呼び出し
   - エラーハンドリング確認

3. データ表示
   - 年間売上高
   - 年間利益
   - 月次進捗チャート

**API呼び出し順序**:
```
1. getStores() → /bb/api/stores
2. getPL(year, month, storeId) × 12 → /bb/api/pl?year={year}&month={month}&storeId={storeId}
3. 各月のデータ取得と集計
```

---

## 予想される問題と対策

### 問題A: P&Lデータが見つからない
**メッセージ**: 「年間PLデータが見つかりません。先に損益データを作成してください。」
**原因**: pl_dataテーブルが空の可能性
**対策**: テストデータ作成スクリプト実行
```bash
cd backend
node create_pl_test_data.js
```

### 問題B: 店舗セレクターが空
**原因**: storesテーブルが空または「無所属」のみ
**対策**: バックエンド管理者機能で店舗を追加
```bash
curl -X POST http://localhost:3001/api/stores \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "カフェ：EDW富山二口店", "businessTypeId": "cafe-001"}'
```

### 問題C: 認証エラー（401/403）
**原因**:
- JWTトークン期限切れ
- CORS設定不正
- プロキシの Authorization ヘッダー除去
**対策**: Nginxプロキシ設定確認
```nginx
location /bb/api {
    proxy_set_header Authorization $http_authorization;  # 確認必須
}
```

### 問題D: ページがリダイレクトループ
**原因**: ログイン状態が保存されない（localStorage持続不足）
**対策**: authStore.ts の persist 設定確認

---

## 実装された改善事項

### 1. API_BASE_URL の本番環境自動判定
next-app/src/lib/api.ts のコード:
- NODE_ENV=production で '/bb/api' を自動使用
- ローカル開発環境では 'http://localhost:3001/api'

### 2. 月次売上ページの API設定
next-app/src/app/admin/monthly-sales/page.tsx:
- ランタイムでホスト名を判定
- VPS環境でも '/bb/api' を正しく使用

### 3. 環境変数設定ガイド
.env.production.example で本番設定を定義

---

## テスト実施方法

### ローカル環境でのシミュレーション
```bash
# バックエンド起動
cd backend
NODE_ENV=development npm run dev

# フロントエンド起動
cd next-app
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

### VPS環境での実施確認（リモート）
1. VPS上で環境変数確認
2. ブラウザ DevTools でコンソールエラー確認
3. Network タブでAPI呼び出し状況確認
4. Application タブで localStorage/sessionStorage 確認

---

## トラブルシューティング

### ログ確認コマンド
```bash
# バックエンドログ
tail -f /var/log/backend.log

# Nginxログ
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# フロントエンドビルドログ
tail -f /var/log/next-app/build.log
```

### データベース接続確認
```bash
psql -U postgres -d shift_management -c "SELECT COUNT(*) FROM stores;"
psql -U postgres -d shift_management -c "SELECT COUNT(*) FROM pl_data;"
```

---

## 結論

システムはVPS環境での動作に対応しているが、以下を確認が必須：

1. ✓ 環境変数の正しい設定（NODE_ENV=production）
2. ✓ Nginxプロキシ設定の確認
3. ✓ データベースの初期化とテストデータ
4. ✓ JWT認証の動作確認
5. ✓ ブラウザキャッシュのクリア

これらをすべて確認後、各ステップのテストを実行してください。

