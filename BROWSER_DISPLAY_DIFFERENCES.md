# ブラウザ表示の違いについて

## 問題の概要

通常のブラウザとブラウザモード（MCPブラウザツール）で表示が異なる原因と対処法について説明します。

---

## 考えられる原因

### 1. **ビューポートサイズの違い** ⭐ 最も可能性が高い

**原因:**
- ブラウザツールのデフォルトビューポートサイズが通常のブラウザと異なる
- レスポンシブデザインのメディアクエリが異なるサイズで発動している

**確認方法:**
```javascript
// ブラウザコンソールで確認
console.log('Viewport width:', window.innerWidth);
console.log('Viewport height:', window.innerHeight);
console.log('Screen width:', screen.width);
```

**対処法:**
- ブラウザツールのサイズを通常のブラウザと同じに設定
- デスクトップサイズ: 1920x1080 または 1280x720
- モバイルサイズ: 375x667 (iPhone) または 390x844 (iPhone Pro)

---

### 2. **メディアクエリによる表示切り替え**

**コード内のメディアクエリ:**
```css
/* globals.css */
@media (max-width: 767px) {
  .sidebar-fixed {
    display: none !important;  /* モバイルではサイドバー非表示 */
  }
}

@media (min-width: 768px) {
  .sidebar-fixed {
    display: flex !important;  /* デスクトップではサイドバー表示 */
  }
}
```

**サイドバーコンポーネント:**
```tsx
// LayoutSidebar.tsx
<aside className="hidden md:flex ...">
  {/* md:flex = 768px以上で表示 */}
</aside>

// LayoutMobileHeader.tsx
<header className="md:hidden ...">
  {/* md:hidden = 768px未満で表示 */}
</header>
```

**影響:**
- ビューポート幅が768px未満 → モバイル表示（サイドバー非表示、モバイルヘッダー表示）
- ビューポート幅が768px以上 → デスクトップ表示（サイドバー表示、モバイルヘッダー非表示）

---

### 3. **ハイドレーションのタイミング**

**問題:**
- SSR（サーバーサイドレンダリング）とCSR（クライアントサイドレンダリング）で初期表示が異なる
- Zustandストアのハイドレーション完了前にレンダリングされる

**コード:**
```tsx
// LayoutSidebar.tsx
const [isClient, setIsClient] = useState(false);
const actualCollapsed = isHydrated && isClient ? isCollapsed : false;

if (!isClient) {
  return <aside>...</aside>; // 初期表示（ローディング状態）
}
```

**影響:**
- ブラウザツールではハイドレーションのタイミングが異なる可能性
- 初期表示が一瞬異なる

---

### 4. **Service Workerの404エラー**

**確認されたエラー:**
```
Service Worker registration failed: 
Failed to register a ServiceWorker for scope ('https://edwtoyama.com/bb/') 
with script ('https://edwtoyama.com/bb/sw.js'): 
A bad HTTP response code (404) was received when fetching the script.
```

**影響:**
- Service Workerが登録されない
- オフライン機能が動作しない
- キャッシュが効かない

**対処法:**
- `sw.js`ファイルが存在するか確認
- Next.jsのService Worker設定を確認

---

### 5. **JavaScript実行環境の違い**

**可能性:**
- ブラウザツールはHeadless Chromeを使用
- 一部のブラウザAPIが異なる動作をする可能性
- User-Agentが異なる

**確認方法:**
```javascript
console.log('User-Agent:', navigator.userAgent);
console.log('Platform:', navigator.platform);
```

---

## 具体的な対処法

### 方法1: ブラウザツールのサイズを調整

```javascript
// デスクトップサイズに設定
browser_resize({ width: 1920, height: 1080 })

// または通常のブラウザと同じサイズに設定
browser_resize({ width: 1280, height: 720 })
```

### 方法2: メディアクエリのブレークポイントを確認

現在のブレークポイント:
- **モバイル**: `max-width: 767px` (768px未満)
- **デスクトップ**: `min-width: 768px` (768px以上)

**確認:**
```javascript
// ブラウザコンソールで確認
const mq = window.matchMedia('(min-width: 768px)');
console.log('Is desktop?', mq.matches);
```

### 方法3: ハイドレーションの改善

```tsx
// より確実なハイドレーション待機
const [isHydrated, setIsHydrated] = useState(false);

useEffect(() => {
  // ハイドレーション完了を待つ
  const timer = setTimeout(() => {
    setIsHydrated(true);
  }, 100);
  
  return () => clearTimeout(timer);
}, []);
```

---

## 推奨される確認手順

### 1. ビューポートサイズの確認

通常のブラウザで:
```javascript
// 開発者ツールのコンソールで実行
console.log({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  outerWidth: window.outerWidth,
  outerHeight: window.outerHeight
});
```

ブラウザツールで:
```javascript
// 同じ値を確認
browser_resize({ width: 1920, height: 1080 })
browser_snapshot()
```

### 2. メディアクエリの確認

```javascript
// どのメディアクエリが適用されているか確認
const queries = [
  '(max-width: 767px)',  // モバイル
  '(min-width: 768px)',  // デスクトップ
];

queries.forEach(q => {
  const mq = window.matchMedia(q);
  console.log(`${q}: ${mq.matches}`);
});
```

### 3. 実際の違いを特定

**確認すべき項目:**
- [ ] サイドバーの表示/非表示
- [ ] モバイルヘッダーの表示/非表示
- [ ] レイアウトの幅（margin-left）
- [ ] フォントサイズ
- [ ] 色やスタイル

---

## よくある違いの例

### 例1: サイドバーが表示されない

**原因:** ビューポート幅が768px未満

**対処:**
```javascript
browser_resize({ width: 1920, height: 1080 })
```

### 例2: レイアウトが崩れる

**原因:** ハイドレーションのタイミング

**対処:** コードでハイドレーション待機を改善

### 例3: スタイルが適用されない

**原因:** CSSの読み込みタイミング

**対処:** スタイルの読み込みを確認

---

## まとめ

**主な原因:**
1. ⭐ **ビューポートサイズの違い**（最も可能性が高い）
2. メディアクエリによる表示切り替え
3. ハイドレーションのタイミング
4. Service Workerの404エラー

**推奨対処法:**
1. ブラウザツールのサイズを通常のブラウザと同じに設定
2. ビューポートサイズを確認
3. メディアクエリのブレークポイントを確認

**具体的な違いを教えていただければ、より詳細な対処法を提案できます。**

例えば：
- 「サイドバーが表示されない」
- 「レイアウトの幅が違う」
- 「フォントサイズが違う」
- 「色が違う」

など、具体的な違いを教えてください。

