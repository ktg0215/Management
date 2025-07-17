# データベーステーブル定義（最新版）

## 概要
このドキュメントは、シフト管理システムのデータベーステーブル構造を定義します。

## 主要テーブル

### business_types（業態）
| カラム名     | 型         | 制約                | 説明         |
|--------------|------------|---------------------|--------------|
| id           | UUID       | PRIMARY KEY         | 業態ID       |
| name         | VARCHAR    | NOT NULL, UNIQUE    | 業態名       |
| description  | TEXT       |                     | 業態説明     |
| created_at   | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |
| updated_at   | TIMESTAMP  | DEFAULT NOW()       | 更新日時     |

**現在のデータ（7件）:**
- Cafe: Cafe & Coffee Shop
- Fast Food: Fast Food Restaurant
- Izakaya: Izakaya & Bar
- Manager: Management Business Type（管理者用）
- Ramen: Ramen Shop
- Yakiniku: Yakiniku Restaurant
- 一般: General Business Type（一般店舗用）

### stores（店舗）
| カラム名          | 型         | 制約                | 説明         |
|-------------------|------------|---------------------|--------------|
| id                | UUID       | PRIMARY KEY         | 店舗ID       |
| name              | VARCHAR    | NOT NULL, UNIQUE    | 店舗名       |
| business_type_id  | UUID       | REFERENCES business_types(id) | 業態ID |
| created_at        | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |
| updated_at        | TIMESTAMP  | DEFAULT NOW()       | 更新日時     |

**現在のデータ（8件）:**
- EDW: Yakiniku業態
- Manager: Manager業態（管理者用）
- 本店: Yakiniku業態
- 東京本店: 一般業態
- 大阪支店: 一般業態
- 名古屋支店: 一般業態
- 福岡支店: 一般業態
- 札幌支店: 一般業態

### employees（従業員）
| カラム名      | 型         | 制約                | 説明         |
|---------------|------------|---------------------|--------------|
| id            | UUID       | PRIMARY KEY         | 従業員ID     |
| employee_id   | VARCHAR    | NOT NULL, UNIQUE    | ログインID   |
| email         | VARCHAR    | UNIQUE              | メールアドレス |
| password_hash | VARCHAR    | NOT NULL            | パスワードハッシュ |
| full_name     | VARCHAR    | NOT NULL            | 氏名         |
| nickname      | VARCHAR    |                     | ニックネーム |
| store_id      | UUID       | REFERENCES stores(id) | 所属店舗   |
| role          | VARCHAR    | NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','super_admin')) | 権限 |
| is_active     | BOOLEAN    | DEFAULT TRUE        | 有効フラグ   |
| created_at    | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |
| updated_at    | TIMESTAMP  | DEFAULT NOW()       | 更新日時     |

**現在のデータ（14件）:**
- 総管理者（0000）: Manager店舗、super_admin権限
- 管理者（0001, 0002, 1009）: 各店舗のadmin権限
- 一般ユーザー（1001-1008, 1010, 1111）: user権限

### activity_logs（アクティビティログ）
| カラム名          | 型         | 制約                | 説明         |
|-------------------|------------|---------------------|--------------|
| id                | UUID       | PRIMARY KEY         | ログID       |
| user_id           | UUID       | REFERENCES employees(id) | ユーザーID |
| store_id          | UUID       | REFERENCES stores(id) | 店舗ID     |
| business_type_id  | UUID       | REFERENCES business_types(id) | 業態ID |
| action_type       | VARCHAR    | NOT NULL            | アクション種別 |
| resource_type     | VARCHAR    | NOT NULL            | リソース種別 |
| resource_name     | VARCHAR    |                     | リソース名   |
| description       | TEXT       | NOT NULL            | 説明         |
| created_at        | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |

**特徴:**
- 20件を超えるレコードは自動削除
- 権限別表示制御（管理者: 所属業態のみ、総管理者: 全件）
- Information コンポーネントで使用

### shift_periods（シフト期間）
| カラム名            | 型         | 制約                | 説明         |
|---------------------|------------|---------------------|--------------|
| id                  | UUID       | PRIMARY KEY         | 期間ID       |
| store_id            | UUID       | REFERENCES stores(id) | 店舗ID     |
| year                | INTEGER    | NOT NULL            | 年           |
| month               | INTEGER    | NOT NULL            | 月           |
| is_first_half       | BOOLEAN    | NOT NULL            | 前半/後半    |
| start_date          | DATE       | NOT NULL            | 開始日       |
| end_date            | DATE       | NOT NULL            | 終了日       |
| submission_deadline | DATE       | NOT NULL            | 提出期限     |
| created_at          | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |

### shift_submissions（シフト提出）
| カラム名      | 型         | 制約                | 説明         |
|---------------|------------|---------------------|--------------|
| id            | UUID       | PRIMARY KEY         | 提出ID       |
| employee_id   | UUID       | REFERENCES employees(id) ON DELETE CASCADE | 従業員ID |
| period_id     | UUID       | REFERENCES shift_periods(id) ON DELETE CASCADE | 期間ID |
| is_submitted  | BOOLEAN    | DEFAULT FALSE       | 提出済みフラグ|
| submitted_at  | TIMESTAMP  |                     | 提出日時     |
| created_at    | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |
| updated_at    | TIMESTAMP  | DEFAULT NOW()       | 更新日時     |
| UNIQUE(employee_id, period_id) |                    | ユニーク制約 |

### shift_entries（シフト入力）
| カラム名        | 型         | 制約                | 説明         |
|-----------------|------------|---------------------|--------------|
| id              | UUID       | PRIMARY KEY         | エントリID   |
| submission_id   | UUID       | REFERENCES shift_submissions(id) ON DELETE CASCADE | 提出ID |
| work_date       | DATE       | NOT NULL            | 日付         |
| start_time      | VARCHAR    |                     | 開始時刻     |
| end_time        | VARCHAR    |                     | 終了時刻     |
| is_holiday      | BOOLEAN    | DEFAULT FALSE       | 休日フラグ   |
| created_at      | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |
| updated_at      | TIMESTAMP  | DEFAULT NOW()       | 更新日時     |
| UNIQUE(submission_id, work_date) |                  | ユニーク制約 |

### pl_statements（P&L表ヘッダ）
| カラム名      | 型         | 制約                | 説明         |
|---------------|------------|---------------------|--------------|
| id            | UUID       | PRIMARY KEY         | PLヘッダID    |
| store_id      | UUID       | REFERENCES stores(id) | 店舗ID     |
| year          | INTEGER    | NOT NULL            | 年           |
| month         | INTEGER    | NOT NULL            | 月           |
| created_by    | UUID       | REFERENCES employees(id) | 作成者ID |
| created_at    | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |
| updated_at    | TIMESTAMP  | DEFAULT NOW()       | 更新日時     |
| UNIQUE(store_id, year, month) |                    | ユニーク制約 |

### pl_items（P&L表明細）
| カラム名         | 型         | 制約                | 説明         |
|------------------|------------|---------------------|--------------|
| id               | UUID       | PRIMARY KEY         | PL明細ID     |
| pl_statement_id  | UUID       | REFERENCES pl_statements(id) | PLヘッダID |
| subject_name     | VARCHAR    | NOT NULL            | 科目名       |
| estimate         | INTEGER    | NOT NULL DEFAULT 0  | 見込み金額   |
| actual           | INTEGER    | NOT NULL DEFAULT 0  | 実績金額     |
| is_highlighted   | BOOLEAN    | DEFAULT FALSE       | ハイライト   |
| is_subtotal      | BOOLEAN    | DEFAULT FALSE       | 小計フラグ   |
| is_indented      | BOOLEAN    | DEFAULT FALSE       | インデント   |
| sort_order       | INTEGER    | DEFAULT 0           | 並び順       |
| created_at       | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |
| updated_at       | TIMESTAMP  | DEFAULT NOW()       | 更新日時     |

### companies（取引先企業）
| カラム名         | 型         | 制約                | 説明         |
|------------------|------------|---------------------|--------------|
| id               | UUID       | PRIMARY KEY         | 企業ID       |
| name             | VARCHAR    | NOT NULL            | 企業名       |
| bank_name        | VARCHAR    |                     | 銀行名       |
| branch_name      | VARCHAR    |                     | 支店名       |
| account_type     | VARCHAR    |                     | 口座種別     |
| account_number   | VARCHAR    |                     | 口座番号     |
| category         | VARCHAR    | NOT NULL            | 費目カテゴリ |
| payment_type     | VARCHAR    | NOT NULL CHECK (payment_type IN ('regular','irregular','specific')) | 支払い種別 |
| regular_amount   | INTEGER    |                     | 定期支払額   |
| specific_months  | INTEGER[]  |                     | 特定月       |
| is_visible       | BOOLEAN    | DEFAULT TRUE        | 表示フラグ   |
| created_at       | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |
| updated_at       | TIMESTAMP  | DEFAULT NOW()       | 更新日時     |

**現在のデータ（16件）:**
- 重複データはクリーンアップ済み
- 各種費目カテゴリ（広告費、水道光熱費、通信費、賃貸料、保険料、消耗品費、外注費等）

### payments（支払い履歴）
| カラム名         | 型         | 制約                | 説明         |
|------------------|------------|---------------------|--------------|
| id               | UUID       | PRIMARY KEY         | 支払いID     |
| company_id       | UUID       | REFERENCES companies(id) | 企業ID   |
| month            | VARCHAR    | NOT NULL            | 対象年月（YYYY-MM）|
| amount           | INTEGER    | NOT NULL            | 支払額       |
| created_at       | TIMESTAMP  | DEFAULT NOW()       | 作成日時     |
| updated_at       | TIMESTAMP  | DEFAULT NOW()       | 更新日時     |

**現在のデータ（30件）:**
- 重複データはクリーンアップ済み
- 外部キー制約は正常に動作

## 権限レベル定義

### 1. user（一般ユーザー）
- 自分のシフト提出・編集
- 自分のシフト履歴確認
- 自分のプロフィール編集
- **Information表示: なし**

### 2. admin（管理者）
- 一般ユーザーの権限
- 所属業態の全店舗閲覧
- 所属店舗の編集・管理
- 所属業態の従業員管理
- 所属店舗のシフト管理
- **Information表示: 所属業態の最新5件（拡張時10件）**

### 3. super_admin（総管理者）
- 管理者の権限
- 全業態・全店舗の管理
- 全従業員の管理
- 管理者アカウントの作成
- システム設定の変更
- **Information表示: 全業態の最新5件（拡張時20件）**

## アクセス制御の実装

### 業態・店舗アクセス制御
```javascript
// 管理者: 所属業態の全店舗を閲覧可能、所属店舗のみ編集可能
// 総管理者: 全業態・全店舗にアクセス可能
function getAccessibleStores(user) {
  if (user.role === 'super_admin') {
    return getAllStores();
  } else if (user.role === 'admin') {
    return getStoresByBusinessType(user.store.business_type_id);
  }
  return [user.store];
}
```

### 従業員管理フィルタリング
- 総管理者: 業態選択可能、全従業員表示
- 管理者: 所属業態の従業員のみ表示
- 一般ユーザー: アクセス不可

## データベース統計情報（現在）
- business_types: 7件
- stores: 8件
- employees: 14件
- companies: 16件
- payments: 30件
- activity_logs: 3件

## 業態別店舗配置
- Manager: 1店舗（管理者用）
- Yakiniku: 2店舗（本店、EDW）
- 一般: 5店舗（東京本店、大阪支店、名古屋支店、福岡支店、札幌支店）
- その他業態: 0店舗（今後の拡張用）

## テーブル整合性チェック
✅ 全店舗にbusiness_type_idが設定済み
✅ 全従業員にstore_idが設定済み
✅ Manager店舗とManagerビジネスタイプが正しく関連付け済み
✅ 外部キー制約が正常に動作
✅ 重複データはクリーンアップ済み

## 更新履歴
- 2024年12月19日: 初版作成
- 2024年12月19日: アクセス制御・Information機能追加
- 2024年12月19日: データベース整合性チェック・クリーンアップ完了

## 注意事項
1. activity_logsテーブルは20件を超えると古いレコードが自動削除される
2. Manager業態・店舗は管理者用の特別な設定
3. 一般業態は既存店舗の暫定的な分類
4. 権限変更時は関連するアクセス制御も確認が必要 