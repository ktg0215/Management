/**
 * 取引先関連のユーティリティ関数
 */

/**
 * specificMonthsを数値配列に正規化する
 * データベースから取得したデータを統一された形式に変換
 * 
 * @param specificMonths - 変換前のspecificMonths（配列、文字列、数値、null、undefinedなど）
 * @returns 数値配列（空の場合は空配列）
 */
export function normalizeSpecificMonths(specificMonths: any): number[] {
  if (!specificMonths) {
    return [];
  }
  
  if (Array.isArray(specificMonths)) {
    return specificMonths
      .map((m: any) => {
        if (typeof m === 'number') {
          return m;
        }
        if (typeof m === 'string') {
          const parsed = parseInt(m, 10);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      })
      .filter((m: number | null): m is number => m !== null && m >= 1 && m <= 12)
      .sort((a, b) => a - b);
  }
  
  // 単一の値の場合
  if (typeof specificMonths === 'number') {
    return specificMonths >= 1 && specificMonths <= 12 ? [specificMonths] : [];
  }
  
  if (typeof specificMonths === 'string') {
    const parsed = parseInt(specificMonths, 10);
    return parsed >= 1 && parsed <= 12 ? [parsed] : [];
  }
  
  return [];
}

