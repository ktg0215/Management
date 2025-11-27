# ブラウザモードでの開発ガイド

## 概要

ブラウザモードで実際のサイトを見ながら修正を行う方法について説明します。

## 2つの方法

### 方法1: ローカル環境で開発（推奨）

**メリット:**
- ✅ 変更が即座に反映される（ホットリロード）
- ✅ 本番環境に影響しない
- ✅ デバッグが容易
- ✅ エラーが発生しても本番環境に影響しない

**セットアップ:**

```bash
# Terminal 1 - バックエンド起動
cd backend
npm run dev

# Terminal 2 - フロントエンド起動
cd next-app
npm run dev
```

**アクセス:**
- フロントエンド: http://localhost:3002/bb/
- バックエンドAPI: http://localhost:3001

**ブラウザモードでの確認:**
1. ローカル環境を起動
2. Claude Codeのブラウザツールを使用して `http://localhost:3002/bb/` にアクセス
3. 実際の画面を見ながら修正

---

### 方法2: 本番環境で確認（可能）

**メリット:**
- ✅ 実際の本番環境の状態を確認できる
- ✅ 本番環境特有の問題を発見できる

**デメリット:**
- ⚠️ 変更を反映するにはデプロイが必要
- ⚠️ 本番環境に影響を与える可能性がある

**使用方法:**

1. **本番環境のURLにアクセス**
   ```
   https://edwtoyama.com/bb/
   ```

2. **Claude Codeのブラウザツールを使用**
   - `mcp_cursor-ide-browser_browser_navigate` で本番環境にアクセス
   - `mcp_cursor-ide-browser_browser_snapshot` で画面を確認
   - 問題を特定して修正

3. **修正後はデプロイが必要**
   ```bash
   # ローカルで修正
   git add .
   git commit -m "修正内容"
   git push origin main
   
   # VPSでデプロイ
   ssh ktg@160.251.207.87
   cd /home/ktg/management
   git pull origin main
   cd next-app && npm run build
   pm2 restart 7 8
   ```

---

## ブラウザツールの使い方

### 1. ページにアクセス

```javascript
// ローカル環境
browser_navigate({ url: "http://localhost:3002/bb/" })

// 本番環境
browser_navigate({ url: "https://edwtoyama.com/bb/" })
```

### 2. 画面を確認

```javascript
browser_snapshot()  // 現在の画面のスナップショットを取得
```

### 3. 要素をクリック

```javascript
browser_click({ 
  element: "ログインボタン", 
  ref: "button[type='submit']" 
})
```

### 4. テキストを入力

```javascript
browser_type({ 
  element: "勤怠番号入力欄", 
  ref: "input[name='employeeId']", 
  text: "0000" 
})
```

---

## 推奨ワークフロー

### 開発フェーズ

1. **ローカル環境で開発**
   - ローカル環境を起動
   - ブラウザツールで `http://localhost:3002/bb/` にアクセス
   - 問題を特定して修正
   - 変更が即座に反映されることを確認

2. **テスト**
   - ローカル環境で動作確認
   - エラーがないことを確認

3. **デプロイ**
   - 変更をコミット・プッシュ
   - VPSでデプロイ

4. **本番環境で確認**
   - ブラウザツールで `https://edwtoyama.com/bb/` にアクセス
   - 本番環境で正しく動作することを確認

---

## 注意事項

### 本番環境での修正

- ⚠️ **直接本番環境のコードを修正しない**
- ⚠️ **必ずローカル環境で修正してからデプロイ**
- ⚠️ **デプロイ前にテストを実行**

### ブラウザツールの制限

- ブラウザツールは**読み取り専用**ではありませんが、**コードの修正はできません**
- コードの修正はエディタで行う必要があります
- ブラウザツールは**確認とテスト**に使用します

---

## 実際の使用例

### 例1: ログインページの確認

```javascript
// 1. ローカル環境にアクセス
browser_navigate({ url: "http://localhost:3002/bb/login" })

// 2. 画面を確認
browser_snapshot()

// 3. 問題を特定（例: ボタンのスタイルがおかしい）

// 4. エディタで修正
// next-app/src/app/login/page.tsx を修正

// 5. 自動リロードで確認（Next.jsのホットリロード）
```

### 例2: 本番環境での問題確認

```javascript
// 1. 本番環境にアクセス
browser_navigate({ url: "https://edwtoyama.com/bb/" })

// 2. 画面を確認
browser_snapshot()

// 3. 問題を特定（例: エラーメッセージが表示されている）

// 4. ローカル環境で再現
// 5. ローカル環境で修正
// 6. デプロイ
```

---

## まとめ

- **開発時**: ローカル環境（`http://localhost:3002/bb/`）を使用
- **確認時**: 本番環境（`https://edwtoyama.com/bb/`）も使用可能
- **修正**: 必ずローカル環境で行い、デプロイで反映

ブラウザツールは**両方の環境で使用可能**ですが、**開発はローカル環境で行うことを強く推奨**します。

