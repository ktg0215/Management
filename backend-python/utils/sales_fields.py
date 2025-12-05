"""売上項目の取得ユーティリティ"""
from typing import List, Dict
from utils.database import execute_query

def get_sales_fields(store_id: int) -> List[Dict[str, str]]:
    """
    店舗の売上項目を取得
    
    Args:
        store_id: 店舗ID
    
    Returns:
        List[Dict]: 売上項目のリスト [{'key': 'edwNetSales', 'label': 'EDW純売上'}, ...]
    """
    # 店舗のbusiness_type_idを取得
    store_query = """
        SELECT business_type_id
        FROM stores
        WHERE id = %s
    """
    store_result = execute_query(store_query, (store_id,))
    
    if not store_result or not store_result[0]['business_type_id']:
        # business_type_idがない場合は、デフォルトの売上項目を返す
        return [
            {'key': 'edwNetSales', 'label': 'EDW純売上'},
            {'key': 'ohbNetSales', 'label': 'OHB純売上'},
        ]
    
    business_type_id = store_result[0]['business_type_id']
    
    # business_type_fieldsテーブルからフィールド設定を取得
    fields_query = """
        SELECT fields
        FROM business_type_fields
        WHERE business_type_id = %s
    """
    fields_result = execute_query(fields_query, (business_type_id,))
    
    sales_fields = []
    
    if fields_result and fields_result[0]['fields']:
        fields = fields_result[0]['fields']
        if isinstance(fields, list):
            for field in fields:
                # labelに「売上」が含まれる、またはcategoryが'sales'の項目を抽出
                label = field.get('label', '')
                category = field.get('category', '')
                key = field.get('key', '')
                
                if ('売上' in label or category == 'sales') and key:
                    # 計算項目（isCalculated=true）は除外
                    # また、店舗純売上（netSales）はEDW売上とOHB売上の合計なので除外
                    key_lower = key.lower()
                    excluded_keys = ['netsales', 'net_sales', 'net sales', '店舗純売上']
                    is_excluded = field.get('isCalculated', False) or key_lower in excluded_keys or '店舗純売上' in label
                    
                    if not is_excluded:
                        sales_fields.append({
                            'key': key,
                            'label': label,
                        })
    
    # 売上項目が見つからない場合は、daily_dataから「売上」を含む項目を検索
    if not sales_fields:
        # サンプルデータから売上項目を抽出
        sample_query = """
            SELECT daily_data
            FROM sales_data
            WHERE store_id = %s
            LIMIT 1
        """
        sample_result = execute_query(sample_query, (store_id,))
        
        if sample_result and sample_result[0]['daily_data']:
            daily_data = sample_result[0]['daily_data']
            if isinstance(daily_data, dict):
                # 最初の日のデータを取得
                for day_key, day_data in daily_data.items():
                    if isinstance(day_data, dict):
                        # 数値型で「売上」を含むキーを検索
                        for key, value in day_data.items():
                            if isinstance(value, (int, float)) and value > 0:
                                # キー名に「売上」や「Sales」が含まれるか、または大きな数値（売上の可能性）
                                # ただし、店舗純売上（netSales）は除外
                                key_lower = key.lower()
                                excluded_keys = ['netsales', 'net_sales', 'net sales']
                                is_excluded = key_lower in excluded_keys or '店舗純売上' in key
                                
                                if (('売上' in key or 'Sales' in key or 'sales' in key_lower) and 
                                    not is_excluded):
                                    # 既に追加されていない場合のみ追加
                                    if not any(sf['key'] == key for sf in sales_fields):
                                        sales_fields.append({
                                            'key': key,
                                            'label': key,  # ラベルが見つからない場合はキーを使用
                                        })
                        break  # 最初の日のデータのみを使用
    
    # それでも見つからない場合は、デフォルトの売上項目を返す
    if not sales_fields:
        sales_fields = [
            {'key': 'edwNetSales', 'label': 'EDW純売上'},
            {'key': 'ohbNetSales', 'label': 'OHB純売上'},
        ]
    
    return sales_fields

