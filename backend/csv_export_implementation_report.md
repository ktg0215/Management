# CSV出力機能実装レポート

## 実装日時
2025年1月

## 実装内容

### 1. バックエンドAPIエンドポイント

#### 1.1 CSV生成ユーティリティ関数
- **ファイル**: `backend/src/index.ts`
- **関数**: `escapeCsvValue()`, `generateCsv()`
- **機能**:
  - CSV値のエスケープ処理（カンマ、改行、ダブルクォート）
  - BOM付きUTF-8エンコーディング（Excel互換性）

#### 1.2 売上データCSV出力エンドポイント
- **エンドポイント**: `GET /api/sales/export-csv`
- **ファイル**: `backend/src/index.ts`
- **パラメータ**:
  - `storeId` (必須)
  - `startYear` (必須)
  - `startMonth` (必須)
  - `endYear` (必須)
  - `endMonth` (必須)
  - `fields` (必須、カンマ区切り)
- **機能**:
  - 期間内のすべての月の `sales_data` テーブルからデータを取得
  - `daily_data` JSONから日次データを抽出
  - 選択されたフィールドのみを含むCSVを生成
  - BOM付きUTF-8でエンコード

#### 1.3 月次売上データCSV出力エンドポイント
- **エンドポイント**: `GET /api/monthly-sales/export-csv`
- **ファイル**: `backend/src/index.ts`
- **パラメータ**:
  - `storeId` (必須)
  - `startYear` (必須)
  - `startMonth` (必須)
  - `endYear` (必須)
  - `endMonth` (必須)
  - `fields` (必須、カンマ区切り)
- **機能**:
  - 期間内のすべての月の `monthly_sales` テーブルからデータを取得
  - `daily_data` JSONから月次集計データを抽出
  - 選択されたフィールドのみを含むCSVを生成
  - BOM付きUTF-8でエンコード

### 2. フロントエンドAPIクライアント

#### 2.1 `exportSalesCsv` メソッド
- **ファイル**: `next-app/src/lib/api.ts`
- **場所**: `salesApi` オブジェクト内
- **機能**:
  - クエリパラメータとしてAPIに送信
  - Blobとしてレスポンスを受け取り
  - エラーハンドリング

#### 2.2 `exportMonthlySalesCsv` メソッド
- **ファイル**: `next-app/src/lib/api.ts`
- **場所**: `salesApi` オブジェクト内
- **機能**:
  - クエリパラメータとしてAPIに送信
  - Blobとしてレスポンスを受け取り
  - エラーハンドリング

### 3. フロントエンドハンドラー

#### 3.1 売上管理ページの `handleCsvExport`
- **ファイル**: `next-app/src/app/admin/sales-management/page.tsx`
- **変更内容**:
  - クライアント側でのCSV生成を削除
  - `apiClient.salesApi.exportSalesCsv` を呼び出すように変更
  - レスポンスのBlobをダウンロード用URLに変換

#### 3.2 月次売上管理ページの `handleCsvExport`
- **ファイル**: `next-app/src/app/admin/monthly-sales/page.tsx`
- **変更内容**:
  - クライアント側でのCSV生成を削除
  - `apiClient.salesApi.exportMonthlySalesCsv` を呼び出すように変更
  - レスポンスのBlobをダウンロード用URLに変換

## テスト項目

### 売上管理ページ
1. CSV出力ボタンをクリック
2. 期間を選択（開始年月、終了年月）
3. 出力項目を選択
4. CSV出力を実行
5. CSVファイルがダウンロードされることを確認
6. Excelで開いて文字化けがないことを確認

### 月次売上管理ページ
1. CSV出力ボタンをクリック
2. 期間を選択（開始年月、終了年月）
3. 出力項目を選択
4. CSV出力を実行
5. CSVファイルがダウンロードされることを確認
6. Excelで開いて文字化けがないことを確認

## 注意事項

1. **BOM付きUTF-8**: Excelで正しく日本語を表示するために、BOM付きUTF-8エンコーディングを使用
2. **CSVエスケープ**: カンマ、改行、ダブルクォートを含む値は適切にエスケープ
3. **エラーハンドリング**: APIエラー時は適切なエラーメッセージを表示
4. **認証**: すべてのエンドポイントは認証トークンが必要

## 次のステップ

1. ブラウザで実際にテストして動作確認
2. 大量データの場合のパフォーマンステスト
3. エラーハンドリングの改善（必要に応じて）

