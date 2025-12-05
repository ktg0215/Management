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
    db_host = os.getenv('DB_HOST', 'postgres')
    # management-dbが指定されている場合は、postgresも試す（Docker Composeのサービス名）
    try:
        return psycopg2.connect(
            host=db_host,
            port=int(os.getenv('DB_PORT', 5432)),
            database=os.getenv('DB_NAME', 'shift_management'),
            user=os.getenv('DB_USER', 'postgres'),
            password=get_db_password()
        )
    except psycopg2.OperationalError:
        # postgresで失敗した場合、management-dbを試す
        if db_host == 'postgres':
            return psycopg2.connect(
                host='management-db',
                port=int(os.getenv('DB_PORT', 5432)),
                database=os.getenv('DB_NAME', 'shift_management'),
                user=os.getenv('DB_USER', 'postgres'),
                password=get_db_password()
            )
        raise

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

