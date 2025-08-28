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
 * 店舗リストを業態毎にソートする
 * @param stores 店舗リスト
 * @returns ソートされた店舗リスト
 */
export function sortStoresByBusinessType(stores: Store[]): Store[] {
  return [...stores].sort((a, b) => {
    // 業態名でソート（業態が設定されていない場合は最後に）
    const businessTypeA = a.businessTypeName || 'zzz'; // 未設定は最後
    const businessTypeB = b.businessTypeName || 'zzz';
    const businessTypeComparison = businessTypeA.localeCompare(businessTypeB, 'ja');
    
    // 業態が同じ場合は店舗名でソート
    if (businessTypeComparison === 0) {
      return a.name.localeCompare(b.name, 'ja');
    }
    
    return businessTypeComparison;
  });
} 