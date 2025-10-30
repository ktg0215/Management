# API仕様書（完全版）

**最終更新**: 2025年1月30日
**バージョン**: v2.0.0

## ベースURL

- **開発環境**: `http://localhost:3001/api`
- **本番環境**: `https://your-domain.com/api`

## 認証

すべてのAPIエンドポイント（`/auth`を除く）は認証が必要です。

**リクエストヘッダー**:
```
Authorization: Bearer <JWT_TOKEN>
```

**認証エラー**:
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

---

## 目次

1. [認証 (Authentication)](#1-認証-authentication)
2. [ユーザー・従業員 (Employees)](#2-ユーザー従業員-employees)
3. [店舗 (Stores)](#3-店舗-stores)
4. [業態 (Business Types)](#4-業態-business-types)
5. [シフト管理 (Shifts)](#5-シフト管理-shifts)
6. [売上管理 (Sales)](#6-売上管理-sales)
7. [損益管理 (P&L)](#7-損益管理-pl)
8. [支払い管理 (Payments)](#8-支払い管理-payments)
9. [取引先 (Companies)](#9-取引先-companies)
10. [アクティビティログ (Activity Logs)](#10-アクティビティログ-activity-logs)

---

## 1. 認証 (Authentication)

### POST `/auth/login`

ユーザーログイン

**権限**: なし（公開）

**リクエスト**:
```json
{
  "employeeId": "0001",
  "password": "password123"
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "employeeId": "0001",
      "email": "user@example.com",
      "nickname": "太郎",
      "fullName": "山田 太郎",
      "storeId": "store-uuid",
      "role": "user",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST `/auth/register`

新規ユーザー登録

**権限**: なし（初回登録時のみ）

**リクエスト**:
```json
{
  "employeeId": "0002",
  "nickname": "花子",
  "fullName": "田中 花子",
  "storeId": "store-uuid",
  "password": "password123"
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "user": { /* userオブジェクト */ },
    "token": "jwt-token"
  }
}
```

### POST `/auth/logout`

ログアウト

**権限**: 認証済みユーザー

**レスポンス**:
```json
{
  "success": true,
  "message": "ログアウトしました"
}
```

### GET `/auth/me`

現在のユーザー情報取得

**権限**: 認証済みユーザー

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "user": { /* userオブジェクト */ }
  }
}
```

### GET `/auth/check-admins`

既存管理者の存在確認

**権限**: なし（公開）

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "hasAdmins": true
  }
}
```

---

## 2. ユーザー・従業員 (Employees)

### GET `/employees`

従業員一覧取得

**権限**: admin, super_admin

**クエリパラメータ**:
- `storeId` (optional): 店舗IDでフィルタ
- `businessTypeId` (optional): 業態IDでフィルタ
- `role` (optional): ロールでフィルタ (`user`, `admin`, `super_admin`)
- `isActive` (optional): 有効/無効フィルタ

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employeeId": "0001",
      "email": "user@example.com",
      "fullName": "山田 太郎",
      "nickname": "太郎",
      "storeId": "store-uuid",
      "role": "user",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET `/employees/:id`

従業員詳細取得

**権限**: admin, super_admin（または本人）

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "employeeId": "0001",
    /* 他のフィールド */
  }
}
```

### POST `/employees`

従業員作成

**権限**: admin, super_admin

**リクエスト**:
```json
{
  "employeeId": "0003",
  "email": "sato@example.com",
  "fullName": "佐藤 次郎",
  "nickname": "次郎",
  "storeId": "store-uuid",
  "role": "user",
  "password": "password123"
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    /* 作成された従業員情報 */
  }
}
```

### PUT `/employees/:id`

従業員更新

**権限**: admin, super_admin

**リクエスト**:
```json
{
  "fullName": "佐藤 次郎",
  "nickname": "ジロー",
  "role": "admin",
  "isActive": true
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    /* 更新された従業員情報 */
  }
}
```

### DELETE `/employees/:id`

従業員削除（論理削除）

**権限**: super_admin

**レスポンス**:
```json
{
  "success": true,
  "message": "従業員を削除しました"
}
```

---

## 3. 店舗 (Stores)

### GET `/stores`

店舗一覧取得

**権限**: 認証済みユーザー

**クエリパラメータ**:
- `businessTypeId` (optional): 業態IDでフィルタ

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "東京本店",
      "businessTypeId": "business-type-uuid",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET `/stores/:id`

店舗詳細取得

**権限**: 認証済みユーザー

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "東京本店",
    "businessTypeId": "business-type-uuid",
    "businessTypeName": "一般",
    "employeeCount": 10
  }
}
```

### POST `/stores`

店舗作成

**権限**: super_admin

**リクエスト**:
```json
{
  "name": "大阪支店",
  "businessTypeId": "business-type-uuid"
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "name": "大阪支店",
    "businessTypeId": "business-type-uuid"
  }
}
```

### PUT `/stores/:id`

店舗更新

**権限**: super_admin

**リクエスト**:
```json
{
  "name": "大阪支店（リニューアル）",
  "businessTypeId": "business-type-uuid"
}
```

### DELETE `/stores/:id`

店舗削除

**権限**: super_admin

**レスポンス**:
```json
{
  "success": true,
  "message": "店舗を削除しました"
}
```

---

## 4. 業態 (Business Types)

### GET `/business-types`

業態一覧取得

**権限**: 認証済みユーザー

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Yakiniku",
      "description": "Yakiniku Restaurant",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST `/business-types`

業態作成

**権限**: super_admin

**リクエスト**:
```json
{
  "name": "Sushi",
  "description": "Sushi Restaurant"
}
```

---

## 5. シフト管理 (Shifts)

### GET `/shift-periods`

シフト期間一覧取得

**権限**: 認証済みユーザー

**クエリパラメータ**:
- `storeId` (required): 店舗ID

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "storeId": "store-uuid",
      "year": 2024,
      "month": 1,
      "isFirstHalf": true,
      "startDate": "2024-01-01",
      "endDate": "2024-01-15",
      "submissionDeadline": "2023-12-20"
    }
  ]
}
```

### POST `/shift-periods`

シフト期間作成

**権限**: admin, super_admin

**リクエスト**:
```json
{
  "storeId": "store-uuid",
  "year": 2024,
  "month": 2,
  "isFirstHalf": true,
  "startDate": "2024-02-01",
  "endDate": "2024-02-15",
  "submissionDeadline": "2024-01-20"
}
```

### GET `/shift-submissions`

シフト提出一覧取得

**権限**: admin, super_admin

**クエリパラメータ**:
- `periodId` (required): シフト期間ID

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employeeId": "employee-uuid",
      "periodId": "period-uuid",
      "status": "submitted",
      "submittedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### POST `/shift-submissions`

シフト提出作成

**権限**: 認証済みユーザー

**リクエスト**:
```json
{
  "periodId": "period-uuid",
  "employeeId": "employee-uuid",
  "status": "submitted"
}
```

### GET `/shift-entries`

シフト入力取得

**権限**: 認証済みユーザー

**クエリパラメータ**:
- `submissionId` (required): 提出ID

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "submissionId": "submission-uuid",
      "work_date": "2024-01-01",
      "startTime": "09:00",
      "endTime": "18:00",
      "isHoliday": false
    }
  ]
}
```

### POST `/shift-entries`

シフト入力作成

**権限**: 認証済みユーザー

**リクエスト**:
```json
{
  "submissionId": "submission-uuid",
  "work_date": "2024-01-01",
  "startTime": "09:00",
  "endTime": "18:00",
  "isHoliday": false
}
```

---

## 6. 売上管理 (Sales)

### GET `/sales`

売上データ取得

**権限**: admin, super_admin

**クエリパラメータ**:
- `storeId` (required): 店舗ID
- `year` (required): 年
- `month` (required): 月

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "storeId": "store-uuid",
    "year": 2024,
    "month": 1,
    "dailyData": {
      "2024-01-01": {
        "storeNetSales": 100000,
        "creditCardSales": 50000,
        "cashSales": 30000,
        "electronicMoneySales": 15000,
        "qrCodeSales": 5000
      }
    },
    "monthlyTotal": {
      "storeNetSales": 3000000,
      "creditCardSales": 1500000
      /* 他の合計 */
    }
  }
}
```

### POST `/sales`

売上データ保存

**権限**: admin, super_admin

**リクエスト**:
```json
{
  "storeId": "store-uuid",
  "date": "2024-01-01",
  "storeNetSales": 100000,
  "creditCardSales": 50000,
  "cashSales": 30000,
  "electronicMoneySales": 15000,
  "qrCodeSales": 5000
}
```

**レスポンス**:
```json
{
  "success": true,
  "message": "売上データを保存しました"
}
```

---

## 7. 損益管理 (P&L)

### GET `/pl`

P&Lデータ取得

**権限**: admin, super_admin

**クエリパラメータ**:
- `storeId` (required): 店舗ID
- `year` (required): 年
- `month` (required): 月

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "storeId": "store-uuid",
    "year": 2024,
    "month": 1,
    "createdBy": "employee-uuid",
    "items": [
      {
        "id": "item-uuid",
        "subjectName": "バイト給与",
        "estimate": 300000,
        "actual": 280000,
        "isHighlighted": false,
        "isSubtotal": false,
        "isIndented": false,
        "sortOrder": 1
      }
    ]
  }
}
```

### POST `/pl`

P&Lデータ保存

**権限**: admin, super_admin

**リクエスト**:
```json
{
  "storeId": "store-uuid",
  "year": 2024,
  "month": 1,
  "items": [
    {
      "subjectName": "バイト給与",
      "estimate": 300000,
      "actual": 280000,
      "isHighlighted": false,
      "isSubtotal": false,
      "isIndented": false,
      "sortOrder": 1
    }
  ]
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "id": "new-uuid"
  }
}
```

---

## 8. 支払い管理 (Payments)

### GET `/payments`

支払い履歴取得

**権限**: admin, super_admin

**クエリパラメータ**:
- `storeId` (optional): 店舗ID
- `month` (optional): 対象年月 (YYYY-MM形式)

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "companyId": "company-uuid",
      "month": "2024-01",
      "amount": 100000,
      "companyName": "〇〇商事",
      "category": "広告費"
    }
  ]
}
```

### POST `/payments`

支払い記録作成

**権限**: admin, super_admin

**リクエスト**:
```json
{
  "companyId": "company-uuid",
  "month": "2024-01",
  "amount": 100000
}
```

### PUT `/payments/:id`

支払い記録更新

**権限**: admin, super_admin

**リクエスト**:
```json
{
  "amount": 120000
}
```

---

## 9. 取引先 (Companies)

### GET `/companies`

取引先一覧取得

**権限**: admin, super_admin

**クエリパラメータ**:
- `storeId` (optional): 店舗ID
- `category` (optional): 費目カテゴリ
- `isVisible` (optional): 表示フラグ

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "〇〇商事",
      "bankName": "△△銀行",
      "branchName": "□□支店",
      "accountType": "普通",
      "accountNumber": "1234567",
      "category": "広告費",
      "paymentType": "regular",
      "regularAmount": 100000,
      "specificMonths": null,
      "isVisible": true,
      "storeId": "store-uuid"
    }
  ]
}
```

### POST `/companies`

取引先作成

**権限**: admin, super_admin

**リクエスト**:
```json
{
  "name": "〇〇商事",
  "bankName": "△△銀行",
  "branchName": "□□支店",
  "accountType": "普通",
  "accountNumber": "1234567",
  "category": "広告費",
  "paymentType": "regular",
  "regularAmount": 100000,
  "storeId": "store-uuid"
}
```

### PUT `/companies/:id`

取引先更新

**権限**: admin, super_admin

### DELETE `/companies/:id`

取引先削除（論理削除）

**権限**: admin, super_admin

---

## 10. アクティビティログ (Activity Logs)

### GET `/activity-logs`

アクティビティログ取得

**権限**: admin, super_admin

**クエリパラメータ**:
- `limit` (optional): 取得件数（デフォルト: 5、最大: 20）
- `businessTypeId` (optional): 業態IDでフィルタ

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "employee-uuid",
      "storeId": "store-uuid",
      "businessTypeId": "business-type-uuid",
      "actionType": "create",
      "resourceType": "employee",
      "resourceName": "山田 太郎",
      "description": "新しい従業員を作成しました",
      "createdAt": "2024-01-01T10:00:00Z",
      "userName": "管理者",
      "storeName": "東京本店"
    }
  ]
}
```

---

## エラーレスポンス

すべてのエラーは以下の形式で返されます：

```json
{
  "success": false,
  "error": "エラーメッセージ",
  "details": {
    /* オプション: 詳細情報 */
  }
}
```

### HTTPステータスコード

| コード | 説明 |
|--------|------|
| `200` | 成功 |
| `201` | 作成成功 |
| `400` | リクエストエラー（バリデーションエラー等） |
| `401` | 認証エラー（トークン不正・期限切れ） |
| `403` | 権限エラー（アクセス権限なし） |
| `404` | リソースが見つからない |
| `409` | 競合エラー（重複データ等） |
| `500` | サーバーエラー |

---

## レート制限

現在、レート制限は実装されていません。将来的には以下の制限を予定：

- 認証エンドポイント: 5回/分
- その他エンドポイント: 100回/分

---

## WebSocket

現在、WebSocketはコード内に実装されていますが、実際の機能は未実装です。将来的にリアルタイム通知機能で使用予定。

---

**更新履歴**:
- 2024年6月27日: 初版作成
- 2025年1月30日: 完全版に更新、全エンドポイント追加
