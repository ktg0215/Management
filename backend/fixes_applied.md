# 緊急度の高い問題の修正内容

## 修正日: 2025年12月

### 1. クリティカル: ログインページの勤怠番号バリデーション

**問題**: ログインページで4桁の数字のみを許可するバリデーションが設定されていたが、テストユーザーは`test_user_1`のような文字列IDを使用している。

**修正内容**:
- `next-app/src/app/login/page.tsx`を修正
- `maxLength={4}`と`pattern="[0-9]{4}"`を削除
- `maxLength={50}`に変更（データベースの`VARCHAR(50)`に合わせる）
- プレースホルダーを「4桁の数字を入力」から「勤怠番号を入力」に変更
- ラベルを「勤怠番号（4桁）」から「勤怠番号」に変更

**影響**: テストユーザー（`test_user_1`, `test_admin_1`など）でログインできるようになりました。

### 2. 高優先度: 権限チェックの一貫性

**問題**: 一部のページコンポーネントで直接`user.role`をチェックしており、`hasPermission()`関数の使用に統一されていなかった。

**修正内容**:
以下のファイルで`user.role`の直接チェックを`hasPermission()`または`isSuperAdmin()`に統一：

1. **`next-app/src/app/admin/sales-management/page.tsx`**:
   - `user.role !== 'admin' && user.role !== 'super_admin'` → `!hasPermission('admin')`
   - `user.role === 'admin' || user.role === 'super_admin'` → `hasPermission('admin')`
   - `selectedStoreId || user.role === 'admin' || user.role === 'super_admin'` → `selectedStoreId || hasPermission('admin')`

2. **`next-app/src/app/admin/monthly-sales/page.tsx`**:
   - `user.role === 'admin' || user.role === 'super_admin'` → `hasPermission('admin')`

3. **`next-app/src/app/admin/payments/page.tsx`**:
   - `user.role === 'admin' || user.role === 'super_admin'` → `hasPermission('admin')`
   - `user.role === 'super_admin'` → `isSuperAdmin()`

4. **`next-app/src/app/admin/yearly-progress/PLCreate.tsx`**:
   - `user.role === 'super_admin'` → `isSuperAdmin()`

5. **`next-app/src/app/admin/employees/page.tsx`**:
   - `user.role === 'super_admin'` → `isSuperAdmin()`
   - `user.role === 'admin'` → `hasPermission('admin')`

**影響**: 権限チェックのロジックが統一され、メンテナンスが容易になりました。将来的に権限システムを変更する場合も、`authStore.ts`の`hasPermission()`関数を修正するだけで済みます。

### 3. 高優先度: エラーレスポンスの統一

**問題**: 認証ミドルウェアで401と403のエラーが返される際、エラーメッセージが含まれていなかった。

**修正内容**:
- `backend/src/index.ts`の`authenticateToken`関数を修正
- `res.sendStatus(401)` → `res.status(401).json({ error: '認証トークンが提供されていません' })`
- `res.sendStatus(403)` → `res.status(403).json({ error: '認証トークンが無効または期限切れです' })`

**影響**: フロントエンドでエラーの原因を特定しやすくなり、ユーザーに適切なエラーメッセージを表示できるようになりました。

## デプロイ状況

- VPSへのデプロイ: ✅ 完了
- フロントエンドビルド: ✅ 成功
- バックエンド再起動: ✅ 完了（PM2）

## 次のステップ

1. 実際のブラウザテストを実行し、修正が正しく動作することを確認
2. テストユーザーでログインできることを確認
3. 各権限レベルでのアクセス制御が正しく動作することを確認
4. エラーメッセージが適切に表示されることを確認

## 注意事項

- ローカルのgitコミットは手動で実行してください（PowerShellの`&&`演算子の問題のため）
- 本番環境では、テストユーザーのパスワードを変更することを推奨します

