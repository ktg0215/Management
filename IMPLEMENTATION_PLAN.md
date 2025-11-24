# 売上管理 → 月次売上管理 自動反映 実装計画

## 概要
売上管理ページの月間累計データを月次売上管理ページに自動反映させる

## 現在の状況
- 売上管理: バックエンドDB (sales_data テーブル) に日次データを保存
- 月次売上管理: ローカルストレージのみ（バックエンド未実装）
- SimpleSalesTable.tsx に累計行なし

---

## 実装タスク

### 1. SimpleSalesTable.tsx に月間累計行を追加
**ファイル**: `next-app/src/components/sales/SimpleSalesTable.tsx`

**変更内容**:
- 374行目の `</tbody>` の後に `<tfoot>` で月間累計行を追加
- useMemo で全日次データを集計

**累計対象フィールド**:
```typescript
// 合計（sum）
netSales, edwNetSales, ohbNetSales, totalGroups, totalCustomers,
laborCost, lunchSales, dinnerSales, lunchCustomers, dinnerCustomers,
lunchGroups, dinnerGroups, ohbSales, ohbCustomers, ohbGroups,
voidCount, voidAmount, salesDiscrepancy, totalHours, edwBaitHours, ohbBaitHours,
reservationCount, plain, junsei, seasonal, surveyCount,
employeeHours, asHours, katougi, ishimori, osawa, washizuka

// 平均（avg）
laborCostRate, groupUnitPrice, customerUnitPrice, edwCustomerUnitPrice,
lunchUnitPrice, dinnerUnitPrice, ohbCustomerUnitPrice,
edwProductivity, ohbProductivity, totalProductivity, surveyRate
```

---

### 2. バックエンドに月間累計API追加
**ファイル**: `backend/src/routes/salesRoutes.ts` または新規作成

**エンドポイント**: `GET /api/sales/monthly-summary`

**パラメータ**:
- year: number
- month: number
- storeId: string

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "year": 2025,
    "month": 11,
    "storeId": "xxx",
    "summary": {
      "netSales": 1234567,
      "totalGroups": 456,
      "totalCustomers": 789,
      "laborCost": 234567,
      "laborCostRate": 23.5,
      // ... 他のフィールド
    }
  }
}
```

**実装方法**:
- sales_data テーブルから対象月のデータを取得
- daily_data (JSONB) から各日のデータを集計
- 合計・平均を計算して返す

---

### 3. 月次売上管理ページで自動取得・表示
**ファイル**: `next-app/src/app/admin/monthly-sales/page.tsx`

**変更内容**:
1. useEffect で売上管理の月間累計を自動取得
2. 取得したデータを MonthlyData 形式に変換
3. StoreMonthlyDataTable に渡す

**フィールドマッピング** (売上管理 → 月次売上管理):
```typescript
const fieldMapping = {
  // 売上関連
  'netSales': '店舗純売上',
  'edwNetSales': 'EDW純売上',
  'ohbNetSales': 'OHB純売上',

  // 客数・組数
  'totalGroups': '組数（計）',
  'totalCustomers': '客数（計）',
  'groupUnitPrice': '組単価',
  'customerUnitPrice': '客単価',

  // 人件費
  'laborCost': '人件費額',
  'laborCostRate': '人件費率',
  'employeeHours': '社員時間',
  'asHours': 'AS時間',

  // L/D売上
  'lunchSales': 'L：売上',
  'dinnerSales': 'D：売上',
  'lunchCustomers': 'L：客数',
  'dinnerCustomers': 'D：客数',
  'lunchGroups': 'L：組数',
  'dinnerGroups': 'D：組数',

  // VOID
  'voidCount': 'VOID件数',
  'voidAmount': 'VOID金額',
  'salesDiscrepancy': '売上金過不足',

  // 生産性
  'totalHours': '総時間社員込',
  'edwBaitHours': 'EDW総時間',
  'ohbBaitHours': 'OHB総時間',
  'edwProductivity': 'EDW生産性',
  'ohbProductivity': 'OHB生産性',
  'totalProductivity': '総生産性',

  // アンケート
  'surveyCount': 'アンケート取得枚数',
  'surveyRate': 'アンケート取得率',
};
```

---

### 4. 項目設定ページに表示/非表示トグル追加
**ファイル**: `next-app/src/app/admin/sales-field-settings/page.tsx`

**変更内容**:
- SalesFieldConfiguration コンポーネントで isVisible プロパティを編集可能に
- 目のアイコンで表示/非表示を切り替え

---

### 5. 型定義の更新
**ファイル**: `next-app/src/types/monthly-sales.ts`

**変更内容**:
Field インターフェースに isVisible を追加:
```typescript
export interface Field {
  id: string;
  name: string;
  category: FieldCategory;
  type: FieldType;
  unit?: string;
  isRequired: boolean;
  isCalculated: boolean;
  formula?: string;
  order: number;
  isVisible?: boolean;  // 追加
}
```

---

## フィールド対応表（完全版）

| 売上管理フィールド | 月次売上管理フィールド | 集計方法 |
|-------------------|----------------------|---------|
| netSales | 店舗純売上 | sum |
| edwNetSales | EDW純売上 | sum |
| ohbNetSales | OHB純売上 | sum |
| totalGroups | 組数（計） | sum |
| totalCustomers | 客数（計） | sum |
| groupUnitPrice | 組単価 | avg |
| customerUnitPrice | 客単価 | avg |
| laborCost | 人件費額 | sum |
| laborCostRate | 人件費率 | avg |
| employeeHours | 社員時間 | sum |
| asHours | AS時間 | sum |
| lunchSales | L：売上 | sum |
| dinnerSales | D：売上 | sum |
| lunchCustomers | L：客数 | sum |
| dinnerCustomers | D：客数 | sum |
| lunchGroups | L：組数 | sum |
| dinnerGroups | D：組数 | sum |
| voidCount | VOID件数 | sum |
| voidAmount | VOID金額 | sum |
| salesDiscrepancy | 売上金過不足 | sum |
| totalHours | 総時間社員込 | sum |
| edwProductivity | EDW生産性 | avg |
| ohbProductivity | OHB生産性 | avg |
| totalProductivity | 総生産性 | avg |
| surveyCount | アンケート取得枚数 | sum |
| surveyRate | アンケート取得率 | avg |

---

## テスト手順

1. ローカルでバックエンド・フロントエンドを起動
2. 売上管理ページでデータを入力
3. 月間累計行が正しく表示されることを確認
4. 月次売上管理ページを開く
5. 売上管理のデータが自動で表示されることを確認
6. 項目設定で表示/非表示を切り替えて反映を確認
7. ビルド・VPSデプロイ

---

## 進捗状況

- [x] 準備1: SimpleSalesTable.tsx の構造を把握
- [ ] 準備2: 月次売上管理の現在のデータ取得方法を確認
- [ ] 準備3: フィールドマッピングを定義
- [ ] 実装1: SimpleSalesTable.tsx に月間累計行を追加
- [ ] 実装2: バックエンドに月間累計取得APIを追加
- [ ] 実装3: 月次売上管理ページで売上管理の累計データを自動取得・表示
- [ ] 実装4: 項目設定ページに表示/非表示トグルを追加
- [ ] 実装5: monthly-sales.ts に isVisible プロパティを追加
- [ ] テスト: ローカルでビルド・動作確認
- [ ] デプロイ: VPSにデプロイ

---

## 注意事項

1. **累計計算はフロントエンド側で行う** - SimpleSalesTable内でuseMemoを使用
2. **バックエンドAPIは集計済みデータを返す** - monthly-salesページ用
3. **フィールドマッピングは定数として定義** - メンテナンス性向上
4. **isVisible のデフォルトは true** - 既存データとの互換性
