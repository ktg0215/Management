# VPS テスト実行ガイド

## 目次
1. [テスト前準備](#テスト前準備)
2. [Step-by-Step テスト実行](#step-by-step-テスト実行)
3. [トラブルシューティング](#トラブルシューティング)
4. [テスト完了確認](#テスト完了確認)

---

## テスト前準備

### 必要な情報
- VPS URL: `https://edwtoyama.com`
- アプリケーション URL: `https://edwtoyama.com/bb`
- ログイン認証情報:
  - Employee ID: `0000`
  - Password: `admin123`

### ブラウザ準備
1. **シークレットウィンドウを開く** (Ctrl+Shift+N)
   - キャッシュの影響を排除するため
2. **DevTools を開く** (F12)
   - Console タブを確認可能な状態に
   - Network タブで通信監視

### DevTools 設定
```
1. DevTools → Network タブ
2. "Disable cache" をチェック
3. Network の Speed を "Slow 3G" に設定（通信をシミュレート）
```

---

## Step-by-Step テスト実行

### Step 1: ログインページ表示確認

#### 1-1. ページにアクセス
```
URL: https://edwtoyama.com/bb/login/

期待される結果:
✓ ページが表示される
✓ ログインフォーム表示
✓ 「シフト提出システム」のタイトル表示
✓ 勤怠番号 (4桁) 入力フィール
✓ パスワード入力フィール
✓ ログインボタン表示
```

#### 1-2. コンソール確認
```
DevTools → Console タブ

確認項目:
✓ 赤いエラーが表示されていない
✓ 警告 (黄色) が最小限に抑えられている
✓ API_BASE_URL = "/bb/api" がログ出力されていれば確認
```

#### 1-3. スクリーンショット撮影
- ログインページ全体のスクリーンショット保存

**記録項目**: URL, ページタイトル, コンソール出力

---

### Step 2: ログイン実行

#### 2-1. 認証情報入力
```
勤怠番号: 0000
パスワード: admin123
```

#### 2-2. ログインボタンをクリック
```
期待される動作:
1. ボタンに「ログイン中...」と表示される
2. 約1-3秒後にリダイレクト
3. /admin/dashboard へ遷移
```

#### 2-3. ネットワーク通信確認
```
DevTools → Network タブで以下を確認:

リクエスト:
POST https://edwtoyama.com/bb/api/auth/login
Body: {"employeeId":"0000","password":"admin123"}

レスポンス:
Status: 200 OK
Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "employeeId": "0000",
      "fullName": "...",
      "role": "admin",
      "storeId": "..."
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### 2-4. localStorage 確認
```
DevTools → Application → Local Storage

確認項目:
✓ auth-storage キーが作成されている
✓ user オブジェクトが含まれている
✓ token が含まれている (Bearer 形式)

期待される値:
auth-storage:
{
  "state": {
    "user": {"id": "...", "role": "admin"},
    "isAuthenticated": true
  },
  "version": 0
}
```

#### 2-5. スクリーンショット撮影
- ダッシュボード ページのスクリーンショット
- DevTools Network タブの認証レスポンス

**記録項目**: ステータスコード, レスポンスタイム, token の有無

---

### Step 3: 月次売上ページテスト

#### 3-1. ページにアクセス
```
URL: https://edwtoyama.com/bb/admin/monthly-sales/

期待される結果:
✓ ページが表示される
✓ 「月次売上管理」タイトル表示
✓ 店舗セレクター表示
✓ データテーブル表示
```

#### 3-2. 店舗セレクター確認
```
DevTools → Network タブで確認:

API呼び出し:
GET /bb/api/stores
Status: 200 OK

レスポンス確認:
- 店舗が複数存在するか
- 「カフェ：EDW富山二口店」が含まれているか

期待される店舗リスト:
[
  {
    "id": "store-001",
    "name": "カフェ：EDW富山二口店",
    "businessTypeId": "cafe-001"
  },
  ...
]
```

#### 3-3. ドロップダウンメニュー確認
```
操作:
1. 店舗セレクター クリック
2. ドロップダウンメニューが開く

確認項目:
✓ 複数の店舗が表示される
✓ 各店舗名が正しく表示されている
✓ アイコンが表示されている

記録:
- 店舗セレクターのスクリーンショット
- 表示される店舗名リスト
```

#### 3-4. データテーブル確認
```
期待される内容:
✓ 月次データテーブルが表示される
✓ 列ヘッダー: 日付, 売上, 原価など
✓ データ行が表示される

記録:
- データテーブルのスクリーンショット
- テーブル行数とカラム数
```

#### 3-5. API通信確認
```
DevTools → Network タブ

期待される API 呼び出し:
1. GET /bb/api/stores → 200 OK
2. GET /bb/api/monthly-sales?storeId=... → 200 OK
3. (オプション) 他の補助 API

記録項目:
- 各 API のステータスコード
- レスポンスタイム
- レスポンスサイズ
```

#### 3-6. スクリーンショット撮影
- 店舗セレクター表示状態
- データテーブル全体
- DevTools Network タブ

**記録項目**: 店舗数, 表示されたデータ行数, API レスポンスタイム

---

### Step 4: 年間進捗ページテスト

#### 4-1. ページにアクセス
```
URL: https://edwtoyama.com/bb/admin/yearly-progress/

期待される結果:
✓ ページが表示される
✓ 「年間損益進捗」タイトル表示
✓ 4つのサマリーカード表示
✓ 店舗セレクター表示
```

#### 4-2. サマリーカード確認
```
表示されるべきカード:
1. 年間売上高
   - アイコン: 上昇矢印
   - 値: ¥0 以上の数値
   - サブテキスト: "Total Annual Revenue"

2. 年間利益
   - アイコン: ドル記号
   - 値: ¥0 以上の数値
   - サブテキスト: "Total Annual Profit"

3. 年間経費
   - アイコン: 円グラフ
   - 値: ¥0 以上の数値
   - サブテキスト: "Total Annual Expenses"

4. 利益率
   - アイコン: ターゲット
   - 値: X.X% の形式
   - サブテキスト: "Annual Profit Margin"

記録:
- 各カードの値をメモ
- スクリーンショット撮影
```

#### 4-3. P&L データ読み込み確認
```
DevTools → Network タブで確認:

期待される API 呼び出し:
1. GET /bb/api/stores → 200 OK
2. GET /bb/api/pl?year=2025&month=1&storeId=... → 200 OK
3. GET /bb/api/pl?year=2025&month=2&storeId=... → 200 OK
...
12. GET /bb/api/pl?year=2025&month=12&storeId=... → 200 OK

合計: 13回の API 呼び出し (stores 1回 + pl データ 12回)

レスポンス例:
{
  "success": true,
  "data": {
    "revenueEstimate": 1000000,
    "revenueActual": 1100000,
    "profitEstimate": 150000,
    "profitActual": 160000
  }
}

記録:
- API 呼び出し数
- 各レスポンスのステータスコード
- データが空（null）か有無
```

#### 4-4. エラーメッセージ確認
```
データが見つからない場合:

表示されるメッセージ:
"年間PLデータが見つかりません。先に損益データを作成してください。"

→ このメッセージが表示される場合:
   ✓ 正常に動作している（テストデータが必要なだけ）
   ✓ 「損益作成」ボタンで P&L データ作成可能
```

#### 4-5. 月次チャート確認
```
期待される表示:
1. 売上高推移チャート
   - 月ごとのバーチャート
   - ¥XXX,XXX 形式で値表示
   - 12ヶ月分のデータ

2. 利益推移チャート
   - 月ごとのバーチャート
   - ¥XXX,XXX 形式で値表示
   - 12ヶ月分のデータ

記録:
- チャートのスクリーンショット
- データが表示されているか確認
```

#### 4-6. 月次詳細ナビゲーション確認
```
期待される表示:
- 1月〜12月 の 12個のカード
- 各カードに売上・利益・利益率表示
- ホバー時にエフェクト表示

操作:
- 任意の月のカードをクリック
- /admin/pl-create?month=X へ遷移
- P&L 編集画面が表示される

記録:
- 月次カードのスクリーンショット
- クリック後の遷移動作確認
```

#### 4-7. スクリーンショット撮影
- サマリーカード表示
- 売上・利益チャート
- 月次詳細ナビゲーション
- DevTools Network タブ (API 呼び出し)

**記録項目**:
- 年間売上高, 年間利益, 利益率の値
- P&L API のレスポンスタイム
- エラーメッセージの有無

---

## トラブルシューティング

### Issue 1: ログインページが表示されない（404エラー）

```
症状: 「ページが見つかりません」と表示される

解決手順:

1. VPS サーバーの状態確認
   ssh user@edwtoyama.com
   pm2 status

2. フロントエンド アプリケーションが起動しているか確認
   pm2 logs frontend-app | head -20

3. Nginx 設定確認
   sudo nginx -t
   tail -f /var/log/nginx/error.log

4. ポート確認
   netstat -tlnp | grep 3002

5. 再起動
   pm2 restart frontend-app
```

### Issue 2: ログイン失敗（401エラー）

```
症状: ログインボタンをクリックしても「ログインに失敗しました」と表示

確認項目:

1. バックエンド API の状態
   pm2 logs backend-api | tail -20

2. 従業員データの確認
   PGPASSWORD=password psql -U user -d db -c \
     "SELECT * FROM employees WHERE employee_id='0000';"

3. API エンドポイント テスト
   curl -X POST https://edwtoyama.com/bb/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"employeeId":"0000","password":"admin123"}'

4. JWT_SECRET の確認
   cat /path/to/backend/.env | grep JWT_SECRET

対策:
- データベースに従業員データがない場合:
  node create_admin.js で管理者を作成
```

### Issue 3: 店舗セレクターが空

```
症状: 月次売上ページで店舗ドロップダウンが空

確認:

1. ストア データベース確認
   PGPASSWORD=pass psql -U user -d db -c "SELECT * FROM stores;"

2. API レスポンス テスト
   curl https://edwtoyama.com/bb/api/stores \
     -H "Authorization: Bearer {token}"

対策:
- データベースに店舗がない場合:
  INSERT INTO stores (name) VALUES ('カフェ：EDW富山二口店');
```

### Issue 4: P&Lデータが表示されない

```
症状: 年間進捗ページで「年間PLデータが見つかりません」と表示

確認:

1. P&L データテーブル確認
   PGPASSWORD=pass psql -U user -d db -c \
     "SELECT COUNT(*) FROM pl_data;"

2. API テスト
   curl "https://edwtoyama.com/bb/api/pl?year=2025&month=1&storeId=xxx" \
     -H "Authorization: Bearer {token}"

対策:
- テストデータ作成スクリプト実行
  cd backend && NODE_ENV=production node create_pl_test_data.js
```

### Issue 5: Nginxプロキシエラー（502/503）

```
症状: 502 Bad Gateway エラー

確認:

1. Nginx ステータス
   sudo systemctl status nginx

2. バックエンド・フロントエンド起動確認
   pm2 status

3. Nginx ログ確認
   tail -f /var/log/nginx/error.log

4. ポート確認
   netstat -tlnp | grep "3001\|3002"

対策:
- アプリケーション再起動
  pm2 restart all
  pm2 restart frontend-app
  pm2 restart backend-api
```

### Issue 6: API 認証エラー（401/403）

```
症状: API 呼び出しが 401 Unauthorized で失敗

原因: Authorization ヘッダーがプロキシで削除されている

対策:

1. Nginx 設定 確認/修正
   sudo vi /etc/nginx/sites-available/edwtoyama.com

   以下を追加:
   location /bb/api {
       proxy_set_header Authorization $http_authorization;
       proxy_pass_header Authorization;
       proxy_pass http://localhost:3001;
   }

2. Nginx 재시작
   sudo systemctl reload nginx
```

### Issue 7: コンソール エラー「window is undefined」

```
症状: コンソールに次のエラーが表示される

解決: 通常は Next.js の SSR 処理で無視されます
    コンソール エラーが表示されても、ページは正常に表示されるはずです
```

---

## テスト完了確認

### 成功の条件

すべての項目が ✅ の場合、テスト成功です：

#### ログイン
- [ ] ✅ ログインページが表示される
- [ ] ✅ ログインが成功する
- [ ] ✅ localStorage に token が保存される
- [ ] ✅ /admin/dashboard へリダイレクトされる

#### 月次売上ページ
- [ ] ✅ ページが表示される
- [ ] ✅ 店舗セレクターに複数の店舗が表示される
- [ ] ✅ 「カフェ：EDW富山二口店」が表示されている
- [ ] ✅ データテーブルが表示される
- [ ] ✅ 各 API が 200 OK で返る

#### 年間進捗ページ
- [ ] ✅ ページが表示される
- [ ] ✅ 4つのサマリーカードが表示される
- [ ] ✅ 売上・利益チャートが表示される
- [ ] ✅ 月次詳細ナビゲーションが表示される
- [ ] ✅ 各 P&L API が 200 OK で返る
- [ ] ✅ データが表示される (または「データが見つかりません」メッセージ)

#### コンソール
- [ ] ✅ 赤いエラーメッセージがない
- [ ] ✅ 重大な警告メッセージがない

---

## テスト結果レポート

### テスト実施日時
日付: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
時刻: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
VPS URL: https://edwtoyama.com/bb

### テスト実施者
名前: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### テスト結果

#### Step 1: ログインページ
- 結果: [ ] 成功 / [ ] 失敗
- 詳細: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- スクリーンショット: あり [ ] / なし [ ]

#### Step 2: ログイン実行
- 結果: [ ] 成功 / [ ] 失敗
- レスポンスタイム: \_\_\_\_\_\_\_\_ms
- 詳細: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- スクリーンショット: あり [ ] / なし [ ]

#### Step 3: 月次売上ページ
- 結果: [ ] 成功 / [ ] 失敗
- 店舗数: \_\_\_\_\_\_\_\_店舗
- テーブル行数: \_\_\_\_\_\_\_\_行
- 詳細: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- スクリーンショット: あり [ ] / なし [ ]

#### Step 4: 年間進捗ページ
- 結果: [ ] 成功 / [ ] 失敗
- 年間売上高: ¥\_\_\_\_\_\_\_\_\_\_\_
- 年間利益: ¥\_\_\_\_\_\_\_\_\_\_\_
- 利益率: \_\_\_\_\_\_\_\_%
- P&L データ: あり [ ] / なし [ ]
- 詳細: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- スクリーンショット: あり [ ] / なし [ ]

### 総合評価

```
□ 全てのテストが成功（本番環境で正常に動作）
□ ほとんどのテストが成功（軽微な修正で完全対応可能）
□ いくつかのテストが失敗（重要な修正が必要）
□ テストが完全に失敗（デプロイメント再確認が必要）
```

### 次のアクション
1. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
2. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
3. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

**テスト実施完了日**: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

