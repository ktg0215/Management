import { Store } from '@/types/store';

/**
 * 店舗名を「業態：店舗名」の形式で表示する
 * @param store 店舗オブジェクト
 * @returns フォーマットされた店舗名
 */
export function formatStoreName(store: Store): string {
  if (!store) return '';
  
  const businessTypeName = store.businessTypeName || '未設定';
  return `${businessTypeName}：${store.name}`;
}

/**
 * 店舗リストを業態IDでソートする
 * @param stores 店舗リスト
 * @returns ソートされた店舗リスト
 */
export function sortStoresByBusinessType(stores: Store[]): Store[] {
  return [...stores].sort((a, b) => {
    // 業態IDでソート（業態IDが小さい順、未設定は最後に）
    const businessTypeIdA = a.businessTypeId ? parseInt(a.businessTypeId, 10) : 9999;
    const businessTypeIdB = b.businessTypeId ? parseInt(b.businessTypeId, 10) : 9999;

    if (businessTypeIdA !== businessTypeIdB) {
      return businessTypeIdA - businessTypeIdB;
    }

    // 業態が同じ場合は店舗IDでソート（数値として）
    const storeIdA = parseInt(a.id, 10);
    const storeIdB = parseInt(b.id, 10);
    return storeIdA - storeIdB;
  });
} 