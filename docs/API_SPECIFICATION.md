# API仕様書（最新版）

## ベースURL
- 開発環境: `http://localhost:3001/api`
- 本番環境: `https://your-domain.com/api`

## 認証
- JWTトークンを使用。ヘッダーに `Authorization: Bearer <token>` を付与。

## エンドポイント一覧

### 認証 (Authentication)

#### POST /auth/login
ユーザーログイン

**リクエスト**
```json
{
  "employeeId": "0001",
  "password": "password123"
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "employeeId": "0001",
      "nickname": "太郎",
      "fullName": "山田 太郎",
      "storeId": "store-uuid",
      "role": "user"
    },
    "token": "jwt-token"
  }
}
```

#### POST /auth/register
新規ユーザー登録

**リクエスト**
```json
{
  "employeeId": "0002",
  "nickname": "花子",
  "fullName": "田中 花子",
  "storeId": "store-uuid",
  "password": "password123"
}
```

### 店舗管理 (Stores)

#### GET /stores
店舗一覧取得

#### POST /stores
店舗作成（管理者のみ）

**リクエスト**
```json
{
  "name": "大阪支店"
}
```

### 従業員管理 (Employees)

#### GET /employees
従業員一覧取得（管理者のみ）

#### POST /employees
従業員作成（管理者のみ）

**リクエスト**
```json
{
  "employeeId": "0003",
  "fullName": "佐藤 次郎",
  "nickname": "次郎",
  "storeId": "store-uuid",
  "role": "user",
  "password": "password123"
}
```

### シフト管理 (Shifts)

#### GET /shift-periods
シフト期間一覧取得
- クエリ: `?storeId=...`

#### GET /shift-submissions
シフト提出一覧取得
- クエリ: `?periodId=...`

#### POST /shift-submissions
シフト提出作成

**リクエスト**
```json
{
  "periodId": "period-uuid",
  "employeeId": "employee-uuid",
  "status": "submitted"
}
```

### PL（損益）管理

#### GET /pl
PLデータ取得
- クエリ: `?year=2024&month=6&storeId=...`

#### POST /pl
PLデータ保存

**リクエスト**
```json
    {
  "year": 2024,
  "month": 6,
  "storeId": "store-uuid",
  "items": [
    { "name": "バイト給与", "estimate": 300000, "actual": 280000 },
    { "name": "カードポイント", "estimate": 20000, "actual": 21000 }
  ]
}
```

## エラーレスポンス
```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

## HTTPステータスコード
- `200`: 成功
- `201`: 作成成功
- `400`: リクエストエラー
- `401`: 認証エラー
- `403`: 権限エラー
- `404`: リソースが見つからない
- `500`: サーバーエラー
