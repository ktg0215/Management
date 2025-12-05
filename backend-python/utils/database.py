"""データベース接続ユーティリティ"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

def get_db_password():
    """データベースパスワードを取得（DB_PASSWORD_FILEまたはDB_PASSWORDから）"""
    password_file = os.getenv('DB_PASSWORD_FILE')
    if password_file and os.path.exists(password_file):
        with open(password_file, 'r') as f:
            return f.read().strip()
    return os.getenv('DB_PASSWORD', '')

def get_db_connection():
    """PostgreSQLデータベース接続を取得"""
    db_host = os.getenv('DB_HOST', 'management-db')
    db_port = int(os.getenv('DB_PORT', 5432))
    db_name = os.getenv('DB_NAME', 'shift_management')
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = get_db_password()
    
    # 複数のホスト名を試す（フォールバック）
    hosts_to_try = [db_host]
    if db_host == 'postgres':
        hosts_to_try.append('management-db')
    elif db_host == 'management-db':
        hosts_to_try.append('postgres')
    
    last_error = None
    for host in hosts_to_try:
        try:
            return psycopg2.connect(
                host=host,
                port=db_port,
                database=db_name,
                user=db_user,
                password=db_password
            )
        except psycopg2.OperationalError as e:
            last_error = e
            continue
    
    # すべてのホストで失敗した場合
    raise psycopg2.OperationalError(f"Could not connect to database. Tried hosts: {hosts_to_try}. Last error: {last_error}")

def execute_query(query, params=None):
    """クエリを実行して結果を取得"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            if cur.description:
                return cur.fetchall()
            conn.commit()
            return []
    finally:
        conn.close()

