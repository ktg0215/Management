import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt, { verify } from 'jsonwebtoken';
import http from 'http';
import { WebSocketManager } from './websocket/WebSocketServer';

// 環境変数の読み込み
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// データベース接続チェック用ミドルウェア
function requireDatabase(req: Request, res: Response, next: Function) {
  if (!pool) {
    res.status(503).json({ error: 'データベースが利用できません' });
    return;
  }
  next();
}

// スネークケースをキャメルケースに変換するヘルパー関数
function toCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  
  const camelCaseObj: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCaseObj[camelKey] = toCamelCase(obj[key]);
    }
  }
  return camelCaseObj;
}

// ミドルウェアの設定
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json());

// PostgreSQL接続プールの作成
let pool: Pool | null = null;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL?.trim(),
  });
  
  // データベース接続テスト
  pool.connect()
    .then(client => {
      console.log('✅ データベース接続成功');
      client.release();
    })
    .catch(err => {
      console.log('❌ データベース接続失敗:', err.message);
      console.log('⚠️  APIサーバーはデータベースなしで起動します');
      pool = null;
    });
} catch (err) {
  console.log('❌ データベース初期化失敗:', (err as Error).message);
  console.log('⚠️  APIサーバーはデータベースなしで起動します');
  pool = null;
}

// 基本的なルート
app.get('/', (req, res) => {
  res.json({ 
    message: 'シフト提出システム API',
    status: pool ? 'Database connected' : 'Database disconnected',
    timestamp: new Date().toISOString()
  });
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    database: pool ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// 総管理者アカウント作成API
app.post('/api/admin/create-account', requireDatabase, async (req, res) => {
  try {
    const adminCheck = await pool!.query("SELECT COUNT(*) FROM employees WHERE role = 'admin' OR role = 'super_admin'");
    if (parseInt(adminCheck.rows[0].count, 10) > 0) {
      res.status(400).json({ error: '既に管理者が存在します' });
      return;
    }
    const employeeId = '0000';
    const password = 'toyama2023';
    const fullName = '総管理者';
    const nickname = 'superadmin';
    const passwordHash = await bcrypt.hash(password, 10);
    // 無所属店舗がなければ作成し、IDを取得
    let storeId;
    const storeRes = await pool!.query("SELECT id FROM stores WHERE name = '無所属' LIMIT 1");
    if (storeRes.rows.length > 0) {
      storeId = storeRes.rows[0].id;
    } else {
      const insertRes = await pool!.query("INSERT INTO stores (name) VALUES ('無所属') RETURNING id");
      storeId = insertRes.rows[0].id;
    }
    const role = 'super_admin';
    const result = await pool!.query(
      `INSERT INTO employees (email, password, name, store_id, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email as employee_id, name, role, store_id`,
      [employeeId, passwordHash, fullName, nickname, storeId, role]
    );
    const user = toCamelCase(result.rows[0]);
    delete user.passwordHash;
    res.json({ data: { user } });
  } catch (err) {
    console.error('総管理者アカウント作成エラー:', err);
    res.status(500).json({ error: '総管理者アカウントの作成に失敗しました' });
  }
});

// 管理者存在チェックAPI
app.get('/api/admin/check-existing', requireDatabase, async (req, res) => {
  try {
    const adminCheck = await pool!.query("SELECT COUNT(*) FROM employees WHERE role = 'admin' OR role = 'super_admin'");
    const hasAdmins = parseInt(adminCheck.rows[0].count, 10) > 0;
    res.json({ data: { hasAdmins } });
  } catch (err) {
    console.error('管理者存在チェックエラー:', err);
    res.status(500).json({ error: '管理者存在チェックに失敗しました' });
  }
});

// ログインAPI（デバッグ版）
app.post('/api/auth/login', requireDatabase, async (req: Request, res: Response) => {
  const { employeeId, password } = req.body;
  console.log('=== ログイン試行 ===');
  console.log('Employee ID:', employeeId);
  console.log('Password:', password);
  
  try {
    const userResult = await pool!.query(
      `SELECT id, employee_id, full_name, nickname, store_id, password_hash, role, is_active FROM employees WHERE employee_id = $1 LIMIT 1`,
      [employeeId]
    );
    
    console.log('DB検索結果:', userResult.rows.length);
    
    if (userResult.rows.length === 0) {
      console.log('ユーザーが見つかりません');
      res.status(401).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    
    const user = toCamelCase(userResult.rows[0]);
    console.log('ユーザー情報:', { 
      id: user.id, 
      employeeId: user.employeeId, 
      role: user.role, 
      isActive: user.isActive,
      hasPasswordHash: !!user.passwordHash
    });
    
    // 一時的にパスワードチェックをスキップ（従業員ID 0000 & パスワード admin123 の場合）
    let isMatch = false;
    if (employeeId === '0000' && password === 'admin123') {
      console.log('管理者アカウント: パスワードチェックをスキップ');
      isMatch = true;
    } else {
      console.log('bcryptでパスワードを比較中...');
      isMatch = await bcrypt.compare(password, user.passwordHash);
      console.log('bcrypt比較結果:', isMatch);
    }
    
    if (!isMatch) {
      console.log('パスワードが一致しません');
      res.status(401).json({ error: 'パスワードが正しくありません' });
      return;
    }
    
    delete user.passwordHash;
    const token = jwt.sign(
      { id: user.id, employeeId: user.employeeId, role: user.role },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );
    
    console.log('ログイン成功');
    console.log('📤 Response data:', {
      hasUser: !!user,
      hasToken: !!token,
      userKeys: user ? Object.keys(user) : [],
      tokenLength: token ? token.length : 0
    });
    res.json({ data: { user, token } });
  } catch (err) {
    console.error('ログインエラー:', err);
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
});

// JWT認証ミドルウェア
function authenticateToken(req: Request, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.sendStatus(401);
    return;
  }

  verify(token as string, process.env.JWT_SECRET || 'default-secret', (err: any, user: any) => {
    if (err) {
      res.sendStatus(403);
      return;
    }
    (req as any).user = user;
    next();
  });
}

// 現在のユーザー情報取得API
app.get('/api/auth/me', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user;
    const userResult = await pool!.query(
      `SELECT id, employee_id, full_name, nickname, store_id, role, is_active FROM employees WHERE id = $1`,
      [userPayload.id]
    );
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }
    const user = toCamelCase(userResult.rows[0]);
    delete user.passwordHash;
    res.json({ data: { user } });
  } catch (err) {
    console.error('ユーザー情報取得エラー:', err);
    res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
  }
});

// ログアウトAPI
app.post('/api/auth/logout', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    // JWTトークンの無効化は実装が複雑なため、クライアント側でトークンを削除する
    res.json({ data: { message: 'ログアウトしました' } });
  } catch (err) {
    console.error('ログアウトエラー:', err);
    res.status(500).json({ error: 'ログアウトに失敗しました' });
  }
});

// ユーザー登録API
app.post('/api/auth/register', requireDatabase, async (req: Request, res: Response) => {
  const { employeeId, nickname, fullName, storeId, password, role } = req.body;
  try {
    // 既存ユーザーチェック
    const existingUser = await pool!.query(
      'SELECT id FROM employees WHERE email = $1',
      [employeeId]
    );
    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: '既に存在するユーザーです' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role || 'user';
    const result = await pool!.query(
      `INSERT INTO employees (email, password, name, store_id, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email as employee_id, name, role, store_id`,
      [employeeId, passwordHash, fullName, nickname, storeId, userRole]
    );
    const user = toCamelCase(result.rows[0]);
    delete user.passwordHash;
    const token = jwt.sign(
      { id: user.id, employeeId: user.employeeId, role: user.role },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );
    res.json({ data: { user, token } });
  } catch (err) {
    console.error('ユーザー登録エラー:', err);
    res.status(500).json({ error: 'ユーザー登録に失敗しました' });
  }
});

// 店舗管理API
app.get('/api/stores', requireDatabase, async (req: Request, res: Response) => {
  try {
    const result = await pool!.query(`
      SELECT s.id, s.name, s.business_type_id, s.created_at, s.updated_at,
             bt.name as business_type_name, bt.description as business_type_description
      FROM stores s
      LEFT JOIN business_types bt ON s.business_type_id = bt.id
      ORDER BY bt.name, s.name
    `);
    const stores = toCamelCase(result.rows);
    res.json({ data: stores });
  } catch (err) {
    console.error('店舗取得エラー:', err);
    res.status(500).json({ error: '店舗の取得に失敗しました' });
  }
});

app.post('/api/stores', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { name, businessTypeId } = req.body;
  
  // 入力バリデーション
  if (!name || !name.trim()) {
    res.status(400).json({ error: '店舗名は必須です' });
    return;
  }
  
  if (!businessTypeId) {
    res.status(400).json({ error: '業態の選択は必須です' });
    return;
  }
  
  try {
    // 業態の存在確認
    const businessTypeCheck = await pool!.query('SELECT id FROM business_types WHERE id = $1', [businessTypeId]);
    if (businessTypeCheck.rows.length === 0) {
      res.status(400).json({ error: '指定された業態が存在しません' });
      return;
    }
    
    const result = await pool!.query(
      'INSERT INTO stores (name, business_type_id) VALUES ($1, $2) RETURNING id',
      [name.trim(), businessTypeId]
    );
    const newStoreId = result.rows[0].id;

    // 業態名を含めて再取得
    const storeWithBT = await pool!.query(`
      SELECT s.id, s.name, s.business_type_id, s.created_at, s.updated_at,
             bt.name as business_type_name, bt.description as business_type_description
      FROM stores s
      LEFT JOIN business_types bt ON s.business_type_id = bt.id
      WHERE s.id = $1
    `, [newStoreId]);

    const store = toCamelCase(storeWithBT.rows[0]);
    res.json({ data: store });
  } catch (err) {
    console.error('店舗作成エラー:', err);
    if ((err as any).code === '23505') {
      res.status(409).json({ error: 'この店舗名は既に存在します' });
    } else {
      res.status(500).json({ error: '店舗の作成に失敗しました' });
    }
  }
});

app.put('/api/stores/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, businessTypeId } = req.body;
  
  // 入力バリデーション
  if (!name || !name.trim()) {
    res.status(400).json({ error: '店舗名は必須です' });
    return;
  }
  
  if (!businessTypeId) {
    res.status(400).json({ error: '業態の選択は必須です' });
    return;
  }
  
  try {
    // 業態の存在確認
    const businessTypeCheck = await pool!.query('SELECT id FROM business_types WHERE id = $1', [businessTypeId]);
    if (businessTypeCheck.rows.length === 0) {
      res.status(400).json({ error: '指定された業態が存在しません' });
      return;
    }
    
    const result = await pool!.query(
      `UPDATE stores SET name = $1, business_type_id = $2, updated_at = NOW() WHERE id = $3
       RETURNING id, name, business_type_id, created_at, updated_at`,
      [name.trim(), businessTypeId, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: '店舗が見つかりません' });
      return;
    }

    // 業態名を含めて再取得
    const storeWithBT = await pool!.query(`
      SELECT s.id, s.name, s.business_type_id, s.created_at, s.updated_at,
             bt.name as business_type_name, bt.description as business_type_description
      FROM stores s
      LEFT JOIN business_types bt ON s.business_type_id = bt.id
      WHERE s.id = $1
    `, [id]);

    const store = toCamelCase(storeWithBT.rows[0]);
    res.json({ data: store });
  } catch (err) {
    console.error('店舗更新エラー:', err);
    if ((err as any).code === '23505') {
      res.status(409).json({ error: 'この店舗名は既に存在します' });
    } else {
      res.status(500).json({ error: '店舗の更新に失敗しました' });
    }
  }
});

app.delete('/api/stores/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool!.query('DELETE FROM stores WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: '店舗が見つかりません' });
    }
    res.json({ data: { message: '店舗を削除しました' } });
  } catch (err) {
    console.error('店舗削除エラー:', err);
    res.status(500).json({ error: '店舗の削除に失敗しました' });
  }
});

// 業態管理API
app.get('/api/business-types', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await pool!.query('SELECT * FROM business_types ORDER BY name');
    const businessTypes = toCamelCase(result.rows);
    res.json({ data: businessTypes });
  } catch (err) {
    console.error('業態取得エラー:', err);
    res.status(500).json({ error: '業態の取得に失敗しました' });
  }
});

app.post('/api/business-types', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { name, description } = req.body;
  try {
    const result = await pool!.query(
      'INSERT INTO business_types (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    const businessType = toCamelCase(result.rows[0]);
    res.json({ data: businessType });
  } catch (err) {
    console.error('業態作成エラー:', err);
    if ((err as any).code === '23505') {
      res.status(409).json({ error: 'この業態名は既に存在します' });
    } else {
      res.status(500).json({ error: '業態の作成に失敗しました' });
    }
  }
});

app.put('/api/business-types/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const result = await pool!.query(
      'UPDATE business_types SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: '業態が見つかりません' });
      return;
    }
    const businessType = toCamelCase(result.rows[0]);
    res.json({ data: businessType });
  } catch (err) {
    console.error('業態更新エラー:', err);
    if ((err as any).code === '23505') {
      res.status(409).json({ error: 'この業態名は既に存在します' });
    } else {
      res.status(500).json({ error: '業態の更新に失敗しました' });
    }
  }
});

app.delete('/api/business-types/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool!.connect();

  try {
    await client.query('BEGIN');

    // 削除対象の業態情報を取得
    const businessTypeResult = await client.query('SELECT name FROM business_types WHERE id = $1', [id]);
    if (businessTypeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: '業態が見つかりません' });
      return;
    }

    const businessTypeName = businessTypeResult.rows[0].name;

    // 必須業態の削除を防止
    const protectedBusinessTypes = ['Manager', '管理者', '温野菜', 'ピザーラ', 'EDW'];
    if (protectedBusinessTypes.includes(businessTypeName)) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `${businessTypeName}業態は必須業態のため削除できません` });
      return;
    }

    // この業態を使用している店舗のIDを取得
    const storesResult = await client.query('SELECT id FROM stores WHERE business_type_id = $1', [id]);
    const storeIds = storesResult.rows.map(row => row.id);

    // 関連データをカスケード削除
    if (storeIds.length > 0) {
      // 売上データを削除
      await client.query('DELETE FROM sales WHERE store_id = ANY($1)', [storeIds]);

      // 月次売上データを削除（存在する場合）
      try {
        await client.query('DELETE FROM sales_data WHERE store_id = ANY($1)', [storeIds]);
      } catch (e) {
        // sales_dataテーブルが存在しない場合はスキップ
        console.log('sales_dataテーブルは存在しないためスキップしました');
      }

      // シフトエントリを削除
      await client.query('DELETE FROM shift_entries WHERE store_id = ANY($1)', [storeIds]);

      // 店舗を削除
      await client.query('DELETE FROM stores WHERE business_type_id = $1', [id]);
    }

    // 最後に業態を削除
    const result = await client.query('DELETE FROM business_types WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: '業態が見つかりません' });
      return;
    }

    await client.query('COMMIT');
    res.json({ data: { message: '業態と関連するすべてのデータを削除しました' } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('業態削除エラー:', err);
    res.status(500).json({ error: '業態の削除に失敗しました' });
  } finally {
    client.release();
  }
});

app.get('/api/activity-logs', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { limit = '5' } = req.query;
  const user = (req as any).user;

  try {
    // activity_logsテーブルが存在するかチェック
    const tableCheck = await pool!.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'activity_logs'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // テーブルが存在しない場合は空配列を返す
      res.json({ data: [] });
      return;
    }

    let query = `
      SELECT al.*, e.full_name as user_name, s.name as store_name, bt.name as business_type_name
      FROM activity_logs al
      LEFT JOIN employees e ON al.user_id = e.id
      LEFT JOIN stores s ON al.store_id = s.id
      LEFT JOIN business_types bt ON al.business_type_id = bt.id
    `;
    let params: any[] = [];

    if (user.role === 'user') {
      // 一般ユーザーは何も表示しない
      res.json({ data: [] });
      return;
    } else if (user.role === 'admin') {
      // 管理者は所属業態内の活動のみ
      query += `
        WHERE al.business_type_id = (
          SELECT bt.id FROM business_types bt
          JOIN stores s ON bt.id = s.business_type_id
          WHERE s.id = $1
        )
      `;
      params.push(user.storeId);
    }
    // 総管理者は全活動を見る（WHERE句なし）

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit as string));

    const result = await pool!.query(query, params);
    const logs = toCamelCase(result.rows);
    res.json({ data: logs });
  } catch (err) {
    console.error('活動ログ取得エラー:', err);
    res.status(500).json({ error: '活動ログの取得に失敗しました' });
  }
});

// 従業員管理API
app.get('/api/employees', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await pool!.query(`
      SELECT e.id, e.employee_id, e.full_name, e.nickname, e.store_id, e.role, e.is_active, s.name as store_name
        FROM employees e
        LEFT JOIN stores s ON e.store_id = s.id
        ORDER BY e.employee_id
    `);
    const employees = toCamelCase(result.rows);
    res.json({ data: employees });
  } catch (err) {
    console.error('従業員取得エラー:', err);
    res.status(500).json({ error: '従業員の取得に失敗しました' });
  }
});

app.post('/api/employees', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { employeeId, fullName, nickname, storeId, password, role } = req.body;

  // 勤怠番号のバリデーション（4桁まで）
  if (!employeeId || !/^\d{1,4}$/.test(employeeId)) {
    res.status(400).json({ error: '勤怠番号は1〜4桁の数字である必要があります' });
    return;
  }

  try {
    // 既存ユーザーチェック
    const existingUser = await pool!.query(
      'SELECT id FROM employees WHERE email = $1',
      [employeeId]
    );
    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: '既に存在する従業員IDです' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role || 'user';
    const result = await pool!.query(
      `INSERT INTO employees (email, password, name, store_id, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email as employee_id, name, role, store_id`,
      [employeeId, passwordHash, fullName, nickname, storeId, userRole]
    );
    const employee = toCamelCase(result.rows[0]);
    delete employee.passwordHash;
    res.json({ data: employee });
  } catch (err) {
    console.error('従業員作成エラー:', err);
    res.status(500).json({ error: '従業員の作成に失敗しました' });
  }
});

app.put('/api/employees/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { fullName, nickname, storeId, role } = req.body;
  try {
    const result = await pool!.query(
      `UPDATE employees SET full_name = $1, nickname = $2, store_id = $3, role = $4, updated_at = NOW() 
       WHERE id = $5 RETURNING *`,
      [fullName, nickname, storeId, role, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: '従業員が見つかりません' });
    }
    const employee = toCamelCase(result.rows[0]);
    delete employee.passwordHash;
    res.json({ data: employee });
  } catch (err) {
    console.error('従業員更新エラー:', err);
    res.status(500).json({ error: '従業員の更新に失敗しました' });
  }
});

app.delete('/api/employees/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool!.query('DELETE FROM employees WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: '従業員が見つかりません' });
    }
    res.json({ data: { message: '従業員を削除しました' } });
  } catch (err) {
    console.error('従業員削除エラー:', err);
    res.status(500).json({ error: '従業員の削除に失敗しました' });
  }
});

// シフト期間管理API
app.get('/api/shift-periods', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    // shift_periodsテーブルにはstore_idカラムがないため、全件取得
    const query = 'SELECT * FROM shift_periods ORDER BY year DESC, month DESC, period DESC';
    const result = await pool!.query(query);
    const periods = toCamelCase(result.rows);
    res.json({ data: periods });
  } catch (err) {
    console.error('シフト期間取得エラー:', err);
    res.status(500).json({ error: 'シフト期間の取得に失敗しました' });
  }
});

// シフト提出管理API
app.get('/api/shift-submissions', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { periodId } = req.query;
  // periodIdが存在し、かつUUID形式でない場合は400エラー
  if (periodId && !/^[0-9a-fA-F-]{36}$/.test(periodId as string)) {
    res.status(400).json({ error: 'periodIdが不正です（UUID形式のみ許可）' });
  }
  try {
    let query = `
      SELECT ss.*, e.full_name as employee_name, e.employee_id
      FROM shift_submissions ss
      JOIN employees e ON ss.user_id = e.id
      JOIN shift_periods sp ON ss.shift_period_id = sp.id
    `;
    let params: any[] = [];
    
    if (periodId) {
      query += ' WHERE ss.shift_period_id = $1';
      params.push(periodId);
    }
    
    query += ' ORDER BY ss.created_at DESC';
    
    const result = await pool!.query(query, params);
    const submissions = toCamelCase(result.rows);
    res.json({ data: submissions });
  } catch (err) {
    console.error('シフト提出取得エラー:', err);
    res.status(500).json({ error: 'シフト提出の取得に失敗しました' });
  }
});

app.post('/api/shift-submissions', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { periodId, employeeId, status } = req.body;
  try {
    const result = await pool!.query(
      `INSERT INTO shift_submissions (shift_period_id, user_id, status)
       VALUES ($1, $2, $3) RETURNING *`,
      [periodId, employeeId, status || 'draft']
    );
    const submission = toCamelCase(result.rows[0]);
    res.json({ data: submission });
  } catch (err) {
    console.error('シフト提出作成エラー:', err);
    res.status(500).json({ error: 'シフト提出の作成に失敗しました' });
  }
});

app.put('/api/shift-submissions/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool!.query(
      `UPDATE shift_submissions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'シフト提出が見つかりません' });
    }
    const submission = toCamelCase(result.rows[0]);
    res.json({ data: submission });
  } catch (err) {
    console.error('シフト提出更新エラー:', err);
    res.status(500).json({ error: 'シフト提出の更新に失敗しました' });
  }
});

app.post('/api/shift-submissions/:id/submit', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool!.query(
      `UPDATE shift_submissions SET status = 'submitted', submitted_at = NOW(), updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'シフト提出が見つかりません' });
    }
    const submission = toCamelCase(result.rows[0]);
    res.json({ data: submission });
  } catch (err) {
    console.error('シフト提出エラー:', err);
    res.status(500).json({ error: 'シフト提出に失敗しました' });
  }
});

// シフトエントリ管理API
app.get('/api/shift-entries', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { submissionId } = req.query;
  try {
    let query = 'SELECT * FROM shift_entries';
    let params: any[] = [];
    
    if (submissionId) {
      query += ' WHERE submission_id = $1';
      params.push(submissionId);
    }
    
    query += ' ORDER BY work_date';
    
    const result = await pool!.query(query, params);
    const entries = toCamelCase(result.rows);
    res.json({ data: entries });
  } catch (err) {
    console.error('シフトエントリ取得エラー:', err);
    res.status(500).json({ error: 'シフトエントリの取得に失敗しました' });
  }
});

app.post('/api/shift-entries', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { submissionId, work_date, startTime, endTime, isHoliday } = req.body;
  try {
    const result = await pool!.query(
      `INSERT INTO shift_entries (submission_id, work_date, start_time, end_time, is_holiday)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [submissionId, work_date, startTime, endTime, isHoliday]
    );
    const entry = toCamelCase(result.rows[0]);
    res.json({ data: entry });
  } catch (err) {
    console.error('シフトエントリ作成エラー:', err);
    res.status(500).json({ error: 'シフトエントリの作成に失敗しました' });
  }
});

app.put('/api/shift-entries/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startTime, endTime, isHoliday } = req.body;
  try {
    const result = await pool!.query(
      `UPDATE shift_entries SET start_time = $1, end_time = $2, is_holiday = $3, updated_at = NOW() 
       WHERE id = $4 RETURNING *`,
      [startTime, endTime, isHoliday, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'シフトエントリが見つかりません' });
    }
    const entry = toCamelCase(result.rows[0]);
    res.json({ data: entry });
  } catch (err) {
    console.error('シフトエントリ更新エラー:', err);
    res.status(500).json({ error: 'シフトエントリの更新に失敗しました' });
  }
});

app.delete('/api/shift-entries/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool!.query('DELETE FROM shift_entries WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'シフトエントリが見つかりません' });
    }
    res.json({ data: { message: 'シフトエントリを削除しました' } });
  } catch (err) {
    console.error('シフトエントリ削除エラー:', err);
    res.status(500).json({ error: 'シフトエントリの削除に失敗しました' });
  }
});

// シフトデータ自動削除API（2ヶ月経過したデータを削除）
app.post('/api/shift-cleanup', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    // 2ヶ月前の日付を計算（今日から60日前）
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
    
    console.log('シフトデータクリーンアップ開始:', twoMonthsAgo.toISOString());
    
    // 2ヶ月以上前に終了したシフト期間を取得
    const oldPeriodsResult = await pool!.query(
      'SELECT id, start_date, end_date FROM shift_periods WHERE end_date < $1',
      [twoMonthsAgo.toISOString().split('T')[0]]
    );
    
    if (oldPeriodsResult.rows.length === 0) {
      res.json({ 
        data: { 
          message: '削除対象のシフトデータは見つかりませんでした',
          deletedPeriods: 0,
          deletedSubmissions: 0,
          deletedEntries: 0
        }
      });
      return;
    }
    
    const periodIds = oldPeriodsResult.rows.map(row => row.id);
    console.log('削除対象期間数:', periodIds.length);
    
    // シフトエントリを削除（submissions経由で）
    const deleteEntriesResult = await pool!.query(`
      DELETE FROM shift_entries 
      WHERE submission_id IN (
        SELECT id FROM shift_submissions 
        WHERE shift_period_id = ANY($1)
      )
    `, [periodIds]);
    
    // シフト提出データを削除
    const deleteSubmissionsResult = await pool!.query(
      'DELETE FROM shift_submissions WHERE shift_period_id = ANY($1)',
      [periodIds]
    );
    
    // シフト期間を削除
    const deletePeriodsResult = await pool!.query(
      'DELETE FROM shift_periods WHERE id = ANY($1)',
      [periodIds]
    );
    
    console.log('削除完了:', {
      periods: deletePeriodsResult.rowCount,
      submissions: deleteSubmissionsResult.rowCount,
      entries: deleteEntriesResult.rowCount
    });
    
    res.json({ 
      data: { 
        message: 'シフトデータクリーンアップが完了しました',
        deletedPeriods: deletePeriodsResult.rowCount,
        deletedSubmissions: deleteSubmissionsResult.rowCount,
        deletedEntries: deleteEntriesResult.rowCount,
        cutoffDate: twoMonthsAgo.toISOString().split('T')[0]
      }
    });
  } catch (err) {
    console.error('シフトデータクリーンアップエラー:', err);
    res.status(500).json({ error: 'シフトデータクリーンアップに失敗しました' });
  }
});

// シフトデータクリーンアップのスケジュール実行（毎日午前2時）
const scheduleShiftCleanup = () => {
  const runCleanup = async () => {
    try {
      console.log('定期シフトクリーンアップ実行中...');
      
      // 2ヶ月前の日付を計算
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
      
      // 2ヶ月以上前に終了したシフト期間を取得
      const oldPeriodsResult = await pool!.query(
        'SELECT id FROM shift_periods WHERE end_date < $1',
        [twoMonthsAgo.toISOString().split('T')[0]]
      );
      
      if (oldPeriodsResult.rows.length > 0) {
        const periodIds = oldPeriodsResult.rows.map(row => row.id);
        
        // データを削除
        await pool!.query(`
          DELETE FROM shift_entries 
          WHERE submission_id IN (
            SELECT id FROM shift_submissions 
            WHERE shift_period_id = ANY($1)
          )
        `, [periodIds]);
        
        await pool!.query('DELETE FROM shift_submissions WHERE shift_period_id = ANY($1)', [periodIds]);
        await pool!.query('DELETE FROM shift_periods WHERE id = ANY($1)', [periodIds]);
        
        console.log(`定期クリーンアップ完了: ${periodIds.length}期間のデータを削除`);
      } else {
        console.log('定期クリーンアップ: 削除対象なし');
      }
    } catch (error) {
      console.error('定期クリーンアップエラー:', error);
    }
  };
  
  // 毎日午前2時に実行
  setInterval(runCleanup, 24 * 60 * 60 * 1000); // 24時間ごと
  
  // 初回実行は起動から1時間後
  setTimeout(runCleanup, 60 * 60 * 1000);
};

// サーバー起動時にクリーンアップスケジュールを開始
scheduleShiftCleanup();

// PL（損益）管理API
// PL取得
app.get('/api/pl', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { year, month, storeId } = req.query;
  if (!year || !month || !storeId) {
    res.status(400).json({ error: 'year, month, storeIdは必須です' });
    return;
  }
  try {
    // pl_dataテーブルから取得
    const result = await pool!.query(
      'SELECT * FROM pl_data WHERE year = $1 AND month = $2 AND store_id = $3 LIMIT 1',
      [year, month, storeId]
    );

    // データがない場合は空の配列を返す（新規作成用）
    if (result.rows.length === 0) {
      res.json({ success: true, data: { items: [] } });
      return;
    }

    const row = result.rows[0];

    // pl_itemsテーブルからアイテムを取得
    const itemsResult = await pool!.query(
      'SELECT * FROM pl_items WHERE pl_statement_id = $1 ORDER BY sort_order',
      [row.id]
    );

    // pl_itemsにデータがある場合はそれを使用
    if (itemsResult.rows.length > 0) {
      const items = itemsResult.rows.map(item => ({
        name: item.subject_name,
        estimate: item.estimate || 0,
        actual: item.actual || 0,
        is_highlighted: item.is_highlighted,
        is_subtotal: item.is_subtotal,
        is_indented: item.is_indented
      }));

      res.json({
        success: true,
        data: {
          id: row.id,
          storeId: row.store_id,
          year: row.year,
          month: row.month,
          items: items,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      });
      return;
    }

    // pl_itemsにデータがない場合はpl_dataのdataカラムから取得（後方互換性）
    const data = row.data || {};

    // dataがitems配列を持っている場合はそのまま返す
    if (Array.isArray(data.items)) {
      res.json({
        success: true,
        data: {
          id: row.id,
          storeId: row.store_id,
          year: row.year,
          month: row.month,
          items: data.items,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      });
      return;
    }

    // 旧形式のデータをitems形式に変換
    const items: any[] = [];
    if (data.targetSales || data.totalSales) {
      items.push({ name: '売上', estimate: data.targetSales || 0, actual: data.totalSales || 0 });
    }
    if (data.foodCost) {
      items.push({ name: '原価', estimate: data.foodCost || 0, actual: data.foodCost || 0 });
    }

    res.json({
      success: true,
      data: {
        id: row.id,
        storeId: row.store_id,
        year: row.year,
        month: row.month,
        items: items,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (err) {
    console.error('PL取得エラー:', err);
    res.status(500).json({ error: 'PLデータの取得に失敗しました' });
  }
});

// PL保存
app.post('/api/pl', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { year, month, storeId, items } = req.body;
  const user = (req as any).user;
  
  console.log('PL保存API呼び出し:', { year, month, storeId, itemsCount: items?.length });
  
  if (!year || !month || !storeId || !Array.isArray(items)) {
    console.error('必須パラメータが不足:', { year, month, storeId, itemsType: typeof items });
    res.status(400).json({ error: 'year, month, storeId, itemsは必須です' });
    return;
  }
  
  try {
    // 既存データがあれば削除
    const old = await pool!.query('SELECT id FROM pl_data WHERE year = $1 AND month = $2 AND store_id = $3', [year, month, storeId]);
    if (old.rows.length > 0) {
      await pool!.query('DELETE FROM pl_items WHERE pl_statement_id = $1', [old.rows[0].id]);
      await pool!.query('DELETE FROM pl_data WHERE id = $1', [old.rows[0].id]);
    }
    // 新規作成
    const statementResult = await pool!.query(
      'INSERT INTO pl_data (store_id, year, month, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [storeId, year, month, user.id]
    );
    const plStatementId = statementResult.rows[0].id;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await pool!.query(
        `INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [plStatementId, item.name, item.estimate, item.actual, !!item.is_highlighted, !!item.is_subtotal, !!item.is_indented, i]
      );
    }
    res.json({ data: { id: plStatementId } });
  } catch (err) {
    console.error('PL保存エラー:', err);
    res.status(500).json({ error: 'PLデータの保存に失敗しました' });
  }
});

// 支払い管理API
app.get('/api/payments', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { month, storeId } = req.query;
  console.log('支払いデータ取得API呼び出し:', { month, storeId });
  
  try {
    let query = `
      SELECT p.*, c.name as company_name, c.store_id as company_store_id
      FROM payments p
      LEFT JOIN companies c ON p.company_id = c.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (month) {
      conditions.push('p.month = $' + (params.length + 1));
      params.push(month);
    }
    
    if (storeId) {
      conditions.push('c.store_id = $' + (params.length + 1));
      params.push(storeId);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    const result = await pool!.query(query, params);
    console.log('支払いデータ取得成功:', result.rows.length, '件');
    res.json({ success: true, data: toCamelCase(result.rows) });
  } catch (err) {
    console.error('支払いデータ取得エラー:', err);
    res.status(500).json({ success: false, error: '支払いデータの取得に失敗しました' });
  }
});

app.post('/api/payments', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id, companyId, month, amount, storeId } = req.body;
  if (!companyId || !month || !amount) {
    res.status(400).json({ success: false, error: 'companyId, month, amountは必須です' });
    return;
  }
  try {
    const result = await pool!.query(
      'INSERT INTO payments (id, company_id, month, amount, store_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
      [id, companyId, month, amount, storeId]
    );
    res.json({ success: true, data: toCamelCase(result.rows[0]) });
  } catch (err) {
    console.error('支払いデータ作成エラー:', err);
    res.status(500).json({ success: false, error: '支払いデータの作成に失敗しました' });
  }
});

app.put('/api/payments/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body;
  const user = (req as any).user;
  
  if (!amount) {
    res.status(400).json({ success: false, error: 'amountは必須です' });
    return;
  }
  try {
    // 企業情報を取得（ログ用）
    const paymentInfo = await pool!.query(`
      SELECT p.*, c.name as company_name 
      FROM payments p 
      JOIN companies c ON p.company_id = c.id 
      WHERE p.id = $1
    `, [id]);
    
    const result = await pool!.query(
      'UPDATE payments SET amount = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [amount, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '支払いデータが見つかりません' });
      return;
    }

    // 活動ログを記録
    if (paymentInfo.rows.length > 0) {
      const companyName = paymentInfo.rows[0].company_name;
      const month = paymentInfo.rows[0].month;
      
      // ユーザーの店舗情報と業態情報を取得
      const userInfo = await pool!.query(`
        SELECT s.id as store_id, s.business_type_id 
        FROM employees e 
        JOIN stores s ON e.store_id = s.id 
        WHERE e.id = $1
      `, [user.id]);
      
      if (userInfo.rows.length > 0) {
        const { store_id, business_type_id } = userInfo.rows[0];
        // TODO: Implement createActivityLog function
        // await createActivityLog(
        //   user.id,
        //   store_id,
        //   business_type_id,
        //   'update',
        //   'payment',
        //   `${companyName} (${month})`,
        //   `支払い管理で ${companyName} の ${month} の支払い金額を ¥${amount.toLocaleString()} に更新しました`
        // );
      }
    }

    res.json({ success: true, data: toCamelCase(result.rows[0]) });
  } catch (err) {
    console.error('支払いデータ更新エラー:', err);
    res.status(500).json({ success: false, error: '支払いデータの更新に失敗しました' });
  }
});

app.delete('/api/payments/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool!.query('DELETE FROM payments WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '支払いデータが見つかりません' });
      return;
    }
    res.json({ success: true, data: { message: '支払いデータを削除しました' } });
  } catch (err) {
    console.error('支払いデータ削除エラー:', err);
    res.status(500).json({ success: false, error: '支払いデータの削除に失敗しました' });
  }
});

// 支払いデータ一括保存API
app.post('/api/payments/bulk', requireDatabase, authenticateToken, async (req, res) => {
  const { payments } = req.body;
  console.log('一括保存API呼び出し:', { paymentsCount: payments?.length });
  console.log('受信した支払いデータ:', payments);
  
  if (!Array.isArray(payments)) {
    console.error('paymentsが配列ではありません:', typeof payments);
    res.status(400).json({ error: 'paymentsは配列で送信してください' });
    return;
  }
  
  try {
    let processedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    
    for (const payment of payments) {
      console.log('処理中の支払いデータ:', payment);
      
      // 必須フィールドの検証
      if (!payment.id || !payment.companyId || !payment.month || payment.amount === undefined) {
        console.error('必須フィールドが不足:', payment);
        continue;
      }
      
      // 既存データがあればUPDATE、なければINSERT
      const exists = await pool!.query(
        'SELECT id FROM payments WHERE id = $1',
        [payment.id]
      );
      
      if (exists.rows.length > 0) {
        console.log('既存データを更新:', payment.id);
        await pool!.query(
          'UPDATE payments SET amount = $1, updated_at = NOW() WHERE id = $2',
          [payment.amount, payment.id]
        );
        updatedCount++;
      } else {
        console.log('新規データを挿入:', payment.id);
        // storeIdの型変換処理を追加
        const storeId = typeof payment.storeId === 'string' ? parseInt(payment.storeId) : payment.storeId;
        await pool!.query(
          'INSERT INTO payments (id, company_id, month, amount, store_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
          [payment.id, payment.companyId, payment.month, payment.amount, storeId]
        );
        insertedCount++;
      }
      processedCount++;
    }
    
    console.log('一括保存完了:', { 
      processedCount, 
      insertedCount, 
      updatedCount 
    });
    
    res.json({ 
      success: true, 
      data: { 
        processedCount, 
        insertedCount, 
        updatedCount 
      } 
    });
  } catch (err) {
    console.error('一括保存エラー:', err);
    res.status(500).json({ error: `支払いデータの一括保存に失敗しました: ${err instanceof Error ? err.message : 'Unknown error'}` });
  }
});

// 企業（取引先）管理API
app.get('/api/companies', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId } = req.query;
  try {
    let query = `
      SELECT c.*, s.name as store_name
      FROM companies c
      LEFT JOIN stores s ON c.store_id = s.id
    `;
    const params: any[] = [];
    
    if (storeId) {
      query += ' WHERE c.store_id = $1';
      params.push(storeId);
    }
    
    query += ' ORDER BY c.name';
    
    const result = await pool!.query(query, params);
    const companies = toCamelCase(result.rows);
    res.json({ success: true, data: companies });
  } catch (err) {
    console.error('企業取得エラー:', err);
    res.status(500).json({ success: false, error: '企業の取得に失敗しました' });
  }
});

// 企業情報更新API
app.put('/api/companies/:id', requireDatabase, authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, bankName, branchName, accountType, accountNumber, category, paymentType, regularAmount, specificMonths, isVisible, storeId } = req.body;
  try {
    const result = await pool!.query(
      `UPDATE companies SET
        name = $1,
        bank_name = $2,
        branch_name = $3,
        account_type = $4,
        account_number = $5,
        category = $6,
        payment_type = $7,
        regular_amount = $8,
        specific_months = $9,
        is_visible = $10,
        store_id = $11,
        updated_at = NOW()
      WHERE id = $12 RETURNING *`,
      [name, bankName, branchName, accountType, accountNumber, category, paymentType, regularAmount, specificMonths, isVisible, storeId, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '企業が見つかりません' });
      return;
    }
    res.json({ success: true, data: toCamelCase(result.rows[0]) });
  } catch (err) {
    console.error('企業情報更新エラー:', err);
    res.status(500).json({ success: false, error: '企業情報の更新に失敗しました' });
  }
});

// 企業追加API
app.post('/api/companies', requireDatabase, authenticateToken, async (req, res) => {
  const { name, bankName, branchName, accountType, accountNumber, category, paymentType, regularAmount, specificMonths, isVisible, storeId } = req.body;
  
  console.log('企業追加API呼び出し:', req.body);
  
  // バリデーション
  if (!name || !name.trim()) {
    res.status(400).json({ success: false, error: '取引先名は必須です' });
    return;
  }
  if (!category) {
    res.status(400).json({ success: false, error: '科目は必須です' });
    return;
  }
  if (!paymentType || !['regular', 'irregular'].includes(paymentType)) {
    res.status(400).json({ success: false, error: '支払いタイプは regular または irregular である必要があります' });
    return;
  }
  if (!storeId) {
    res.status(400).json({ success: false, error: '店舗IDは必須です' });
    return;
  }

  // 店舗の存在確認
  try {
    const storeCheck = await pool!.query('SELECT id FROM stores WHERE id = $1', [storeId]);
    if (storeCheck.rows.length === 0) {
      res.status(400).json({ success: false, error: '指定された店舗が存在しません' });
      return;
    }
  } catch (err) {
    console.error('店舗存在確認エラー:', err);
    res.status(500).json({ success: false, error: '店舗の確認に失敗しました' });
    return;
  }
  
  try {
    // 同名企業の重複チェック
    const duplicateCheck = await pool!.query(
      'SELECT id FROM companies WHERE name = $1 AND store_id = $2',
      [name.trim(), storeId]
    );
    if (duplicateCheck.rows.length > 0) {
      res.status(409).json({ success: false, error: '同じ名前の取引先が既に存在します' });
      return;
    }

    // PostgreSQL配列形式に変換
    let specificMonthsArray = null;
    if (specificMonths && Array.isArray(specificMonths)) {
      specificMonthsArray = `{${specificMonths.join(',')}}`;
    }
    
    console.log('データベース挿入開始:', {
      name, bankName, branchName, accountType, accountNumber, 
      category, paymentType, regularAmount, specificMonthsArray, isVisible, storeId
    });
    
    const result = await pool!.query(
      `INSERT INTO companies (name, bank_name, branch_name, account_type, account_number, category, payment_type, regular_amount, specific_months, is_visible, store_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
      [name, bankName, branchName, accountType, accountNumber, category, paymentType, regularAmount, specificMonthsArray, isVisible, storeId]
    );
    
    console.log('企業追加成功:', result.rows[0]);
    res.json({ success: true, data: toCamelCase(result.rows[0]) });
  } catch (err) {
    console.error('企業追加エラー詳細:', err);
    const errorMessage = err instanceof Error ? err.message : '不明なエラー';
    res.status(500).json({ success: false, error: `企業の追加に失敗しました: ${errorMessage}` });
  }
});

// 企業削除API
app.delete('/api/companies/:id', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // 関連する支払いデータの存在確認
    const paymentsResult = await pool!.query('SELECT COUNT(*) as count FROM payments WHERE company_id = $1', [id]);
    const paymentCount = parseInt(paymentsResult.rows[0].count);
    
    if (paymentCount > 0) {
      res.status(400).json({ success: false, error: `この企業には${paymentCount}件の支払いデータが存在するため削除できません` });
      return;
    }
    
    const result = await pool!.query('DELETE FROM companies WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: '企業が見つかりません' });
      return;
    }
    res.json({ success: true, data: { message: '企業を削除しました' } });
  } catch (err) {
    console.error('企業削除エラー:', err);
    res.status(500).json({ success: false, error: '企業の削除に失敗しました' });
  }
});

// 売上データ管理API
app.get('/api/sales', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { year, month, storeId } = req.query;

  if (!storeId) {
    res.status(400).json({ success: false, error: 'storeIdは必須です' });
    return;
  }

  try {
    let result;

    if (year && month) {
      // 特定の年月のデータを取得
      result = await pool!.query(
        `SELECT id, store_id, year, month, daily_data, created_at, updated_at
         FROM sales_data
         WHERE store_id = $1 AND year = $2 AND month = $3`,
        [storeId, year, month]
      );

      if (result.rows.length === 0) {
        console.log(`[API /api/sales] No data found for storeId=${storeId}, year=${year}, month=${month}`);
        res.json({ success: true, data: null });
        return;
      }

      const row = result.rows[0];
      const dailyDataKeys = row.daily_data ? Object.keys(row.daily_data).length : 0;
      console.log(`[API /api/sales] Data found for storeId=${storeId}, year=${year}, month=${month}:`, {
        hasDailyData: !!row.daily_data,
        dailyDataKeys,
        sampleKeys: row.daily_data ? Object.keys(row.daily_data).slice(0, 5) : []
      });
      
      res.json({
        success: true,
        data: {
          id: row.id,
          year: row.year,
          month: row.month,
          store_id: row.store_id,
          daily_data: row.daily_data,
          created_at: row.created_at,
          updated_at: row.updated_at
        }
      });
    } else {
      // 全期間のデータを取得
      result = await pool!.query(
        `SELECT id, store_id, year, month, daily_data, created_at, updated_at
         FROM sales_data
         WHERE store_id = $1
         ORDER BY year DESC, month DESC`,
        [storeId]
      );

      const data = result.rows.map(row => ({
        id: row.id,
        year: row.year,
        month: row.month,
        store_id: row.store_id,
        daily_data: row.daily_data,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      res.json({
        success: true,
        data: data
      });
    }
  } catch (err) {
    console.error('売上データ取得エラー:', err);
    res.status(500).json({ success: false, error: '売上データの取得に失敗しました' });
  }
});

app.post('/api/sales', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { year, month, storeId, dailyData } = req.body;
  const user = (req as any).user;

  if (!year || !month || !storeId || !dailyData) {
    res.status(400).json({ success: false, error: 'year, month, storeId, dailyDataは必須です' });
    return;
  }

  try {
    // 既存データがあれば更新、なければ新規作成
    const existingResult = await pool!.query(
      'SELECT id FROM sales_data WHERE year = $1 AND month = $2 AND store_id = $3',
      [year, month, storeId]
    );

    if (existingResult.rows.length > 0) {
      // 更新
      await pool!.query(
        'UPDATE sales_data SET daily_data = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3',
        [JSON.stringify(dailyData), user.id, existingResult.rows[0].id]
      );
    } else {
      // 新規作成
      await pool!.query(
        'INSERT INTO sales_data (store_id, year, month, daily_data, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6)',
        [storeId, year, month, JSON.stringify(dailyData), user.id, user.id]
      );
    }

    // 月次売上管理（monthly_sales）テーブルにも自動反映
    try {
      const monthlyExistingResult = await pool!.query(
        'SELECT id FROM monthly_sales WHERE store_id = $1 AND year = $2 AND month = $3',
        [storeId, year, month]
      );

      if (monthlyExistingResult.rows.length > 0) {
        // 既存データを更新
        await pool!.query(
          `UPDATE monthly_sales
           SET daily_data = $1, updated_at = NOW()
           WHERE store_id = $2 AND year = $3 AND month = $4`,
          [JSON.stringify(dailyData), storeId, year, month]
        );
      } else {
        // 新規作成
        await pool!.query(
          `INSERT INTO monthly_sales (store_id, year, month, daily_data, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [storeId, year, month, JSON.stringify(dailyData)]
        );
      }
      console.log(`✅ 月次売上管理テーブルへの自動反映完了: store_id=${storeId}, year=${year}, month=${month}`);
    } catch (syncErr) {
      console.error('⚠️ 月次売上管理テーブルへの反映でエラー（メイン処理は成功）:', syncErr);
      // メイン処理は成功しているのでエラーを返さない
    }

    res.json({ success: true, message: '売上データが正常に保存されました（月次売上管理にも反映）' });
  } catch (err) {
    console.error('売上データ保存エラー:', err);
    res.status(500).json({ success: false, error: '売上データの保存に失敗しました' });
  }
});

// 月間累計データ取得API（月次売上管理用）
app.get('/api/sales/monthly-summary', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { year, month, storeId } = req.query;

  if (!year || !month || !storeId) {
    res.status(400).json({ success: false, error: 'year, month, storeIdは必須です' });
    return;
  }

  try {
    // 売上データを取得
    const result = await pool!.query(
      `SELECT daily_data FROM sales_data
       WHERE store_id = $1 AND year = $2 AND month = $3`,
      [storeId, year, month]
    );

    if (result.rows.length === 0) {
      res.json({ success: true, data: null });
      return;
    }

    const dailyData = result.rows[0].daily_data;
    console.log(`[monthly-summary] Found data for storeId=${storeId}, year=${year}, month=${month}`);
    console.log(`[monthly-summary] dailyData type:`, typeof dailyData);
    console.log(`[monthly-summary] dailyData keys count:`, dailyData ? Object.keys(dailyData).length : 0);

    // 日次データを集計
    const dataArray = Object.values(dailyData).filter((d: any) => d && d.netSales !== undefined);
    console.log(`[monthly-summary] dataArray length:`, dataArray.length);

    if (dataArray.length === 0) {
      console.log(`[monthly-summary] No data with netSales, returning null`);
      res.json({ success: true, data: null });
      return;
    }

    // 合計フィールド
    const sumFields = [
      'netSales', 'edwNetSales', 'ohbNetSales', 'totalGroups', 'totalCustomers',
      'laborCost', 'lunchSales', 'dinnerSales', 'lunchCustomers', 'dinnerCustomers',
      'lunchGroups', 'dinnerGroups', 'ohbSales', 'ohbCustomers', 'ohbGroups',
      'voidCount', 'voidAmount', 'salesDiscrepancy', 'totalHours', 'edwBaitHours', 'ohbBaitHours',
      'reservationCount', 'plain', 'junsei', 'seasonal', 'surveyCount',
      'employeeHours', 'asHours', 'katougi', 'ishimori', 'osawa', 'washizuka', 'salesTarget'
    ];

    // 平均フィールド
    const avgFields = [
      'laborCostRate', 'groupUnitPrice', 'customerUnitPrice', 'edwCustomerUnitPrice',
      'lunchUnitPrice', 'dinnerUnitPrice', 'ohbCustomerUnitPrice',
      'edwProductivity', 'ohbProductivity', 'totalProductivity', 'surveyRate',
      'targetRatio', 'yearOverYear', 'edwYearOverYear', 'ohbYearOverYear'
    ];

    const summary: Record<string, number> = {};

    // 合計を計算
    sumFields.forEach(field => {
      const total = dataArray.reduce((sum: number, day: any) => {
        const value = parseFloat(day[field]) || 0;
        return sum + value;
      }, 0);
      summary[field] = total;
    });

    // 平均を計算
    avgFields.forEach(field => {
      const values = dataArray
        .map((day: any) => parseFloat(day[field]))
        .filter((v: number) => !isNaN(v) && v !== 0);

      if (values.length > 0) {
        summary[field] = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      } else {
        summary[field] = 0;
      }
    });

    // 単価系は累計から再計算
    if (summary.totalCustomers > 0) {
      summary.customerUnitPrice = summary.netSales / summary.totalCustomers;
    }
    if (summary.totalGroups > 0) {
      summary.groupUnitPrice = summary.netSales / summary.totalGroups;
    }
    if (summary.lunchCustomers > 0) {
      summary.lunchUnitPrice = summary.lunchSales / summary.lunchCustomers;
    }
    if (summary.dinnerCustomers > 0) {
      summary.dinnerUnitPrice = summary.dinnerSales / summary.dinnerCustomers;
    }

    // EDW客単価
    const edwCustomers = (summary.lunchCustomers || 0) + (summary.dinnerCustomers || 0);
    if (edwCustomers > 0) {
      summary.edwCustomerUnitPrice = summary.edwNetSales / edwCustomers;
    }

    // OHB客単価
    if (summary.ohbCustomers > 0) {
      summary.ohbCustomerUnitPrice = summary.ohbNetSales / summary.ohbCustomers;
    }

    // 人件費率
    if (summary.netSales > 0) {
      summary.laborCostRate = (summary.laborCost / summary.netSales) * 100;
    }

    // 生産性
    if (summary.edwBaitHours > 0) {
      summary.edwProductivity = summary.edwNetSales / summary.edwBaitHours;
    }
    if (summary.ohbBaitHours > 0) {
      summary.ohbProductivity = summary.ohbNetSales / summary.ohbBaitHours;
    }
    if (summary.totalHours > 0) {
      summary.totalProductivity = summary.netSales / summary.totalHours;
    }

    // アンケート取得率
    if (summary.totalCustomers > 0) {
      summary.surveyRate = (summary.surveyCount / summary.totalCustomers) * 100;
    }

    // 予算比
    if (summary.salesTarget > 0) {
      summary.targetRatio = (summary.netSales / summary.salesTarget) * 100;
    }

    res.json({
      success: true,
      data: {
        year: parseInt(year as string),
        month: parseInt(month as string),
        storeId: storeId as string,
        summary,
        dataCount: dataArray.length
      }
    });
  } catch (err) {
    console.error('月間累計データ取得エラー:', err);
    res.status(500).json({ success: false, error: '月間累計データの取得に失敗しました' });
  }
});

// 日別売上データの保存（新規入力・編集用）
app.put('/api/sales/daily', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { year, month, storeId, date, data } = req.body;
  const user = (req as any).user;

  if (!year || !month || !storeId || !date || !data) {
    res.status(400).json({ success: false, error: '必須パラメータが不足しています' });
    return;
  }

  try {
    // 日付から日を抽出
    const dayMatch = date.match(/\d{4}-\d{2}-(\d{2})/);
    if (!dayMatch) {
      res.status(400).json({ success: false, error: '無効な日付形式です' });
      return;
    }
    const day = parseInt(dayMatch[1]);

    // 既存の月次データを取得
    const existingResult = await pool!.query(
      'SELECT * FROM sales WHERE store_id = $1 AND date = $2',
      [storeId, date]
    );

    // データを保存
    if (existingResult.rows.length > 0) {
      // 更新
      await pool!.query(
        'UPDATE sales SET revenue = $1, cost = $2, profit = $3, updated_at = NOW() WHERE store_id = $4 AND date = $5',
        [data.revenue || 0, data.cost || 0, data.profit || 0, storeId, date]
      );
    } else {
      // 新規作成
      await pool!.query(
        'INSERT INTO sales (store_id, date, revenue, cost, profit, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
        [storeId, date, data.revenue || 0, data.cost || 0, data.profit || 0]
      );
    }

    res.json({ success: true, data: { date, updatedData: data } });
  } catch (err) {
    console.error('日別売上データ保存エラー:', err);
    res.status(500).json({ success: false, error: '売上データの保存に失敗しました' });
  }
});

// 月次売上データAPI（monthly_salesテーブルから取得）
app.get('/api/monthly-sales', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, year, month } = req.query;
  try {
    let query = `
      SELECT
        id,
        store_id as "storeId",
        year,
        month,
        daily_data as "dailyData",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM monthly_sales
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (storeId) {
      query += ` AND store_id = $${paramIndex}`;
      params.push(storeId);
      paramIndex++;
    }

    if (year) {
      query += ` AND year = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    }

    if (month) {
      query += ` AND month = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }

    query += ' ORDER BY year DESC, month DESC';

    const result = await pool!.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('月次売上データ取得エラー:', err);
    res.status(500).json({ success: false, error: '月次売上データの取得に失敗しました' });
  }
});

// 月次売上データの保存
app.post('/api/monthly-sales', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, year, month, dailyData } = req.body;

  if (!storeId || !year || !month) {
    res.status(400).json({ success: false, error: '必須パラメータが不足しています' });
    return;
  }

  try {
    // 既存データの確認
    const existingResult = await pool!.query(
      'SELECT id FROM monthly_sales WHERE store_id = $1 AND year = $2 AND month = $3',
      [storeId, year, month]
    );

    if (existingResult.rows.length > 0) {
      // 更新
      await pool!.query(
        `UPDATE monthly_sales
         SET daily_data = $1, updated_at = NOW()
         WHERE store_id = $2 AND year = $3 AND month = $4`,
        [JSON.stringify(dailyData || {}), storeId, year, month]
      );
    } else {
      // 新規作成
      await pool!.query(
        `INSERT INTO monthly_sales (store_id, year, month, daily_data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [storeId, year, month, JSON.stringify(dailyData || {})]
      );
    }

    res.json({ success: true, message: '月次売上データを保存しました' });
  } catch (err) {
    console.error('月次売上データ保存エラー:', err);
    res.status(500).json({ success: false, error: '月次売上データの保存に失敗しました' });
  }
});

// 売上管理から月次売上管理へのデータ同期API
app.post('/api/sync-sales-to-monthly', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    // sales_dataテーブルから全データを取得
    const salesResult = await pool!.query(
      'SELECT store_id, year, month, daily_data FROM sales_data'
    );

    let syncedCount = 0;
    let errorCount = 0;

    for (const salesRow of salesResult.rows) {
      try {
        // monthly_salesテーブルに既存データがあるか確認
        const existingResult = await pool!.query(
          'SELECT id FROM monthly_sales WHERE store_id = $1 AND year = $2 AND month = $3',
          [salesRow.store_id, salesRow.year, salesRow.month]
        );

        if (existingResult.rows.length > 0) {
          // 既存データを更新
          await pool!.query(
            `UPDATE monthly_sales
             SET daily_data = $1, updated_at = NOW()
             WHERE store_id = $2 AND year = $3 AND month = $4`,
            [JSON.stringify(salesRow.daily_data), salesRow.store_id, salesRow.year, salesRow.month]
          );
        } else {
          // 新規作成
          await pool!.query(
            `INSERT INTO monthly_sales (store_id, year, month, daily_data, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [salesRow.store_id, salesRow.year, salesRow.month, JSON.stringify(salesRow.daily_data)]
          );
        }
        syncedCount++;
      } catch (syncErr) {
        console.error(`同期エラー: store_id=${salesRow.store_id}, year=${salesRow.year}, month=${salesRow.month}`, syncErr);
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `同期完了: ${syncedCount}件成功, ${errorCount}件失敗`,
      syncedCount,
      errorCount
    });
  } catch (err) {
    console.error('データ同期エラー:', err);
    res.status(500).json({ success: false, error: 'データ同期に失敗しました' });
  }
});

// P&LデータAPI
app.get('/api/pl-data', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { year, month, storeId } = req.query;
  try {
    let query = `
      SELECT
        id,
        store_id as "storeId",
        year,
        month,
        data,
        created_at as "createdAt",
        updated_at as "updatedAt",
        created_by as "createdBy",
        updated_by as "updatedBy"
      FROM pl_data
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (year) {
      query += ` AND year = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    }

    if (month) {
      query += ` AND month = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }

    if (storeId) {
      query += ` AND store_id = $${paramIndex}`;
      params.push(storeId);
      paramIndex++;
    }

    query += ' ORDER BY year DESC, month DESC';

    const result = await pool!.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('P&Lデータ取得エラー:', err);
    res.status(500).json({ success: false, error: 'P&Lデータの取得に失敗しました' });
  }
});

// P&Lデータの保存
app.post('/api/pl-data', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, year, month, data } = req.body;
  const user = (req as any).user;

  if (!storeId || !year || !month) {
    res.status(400).json({ success: false, error: '必須パラメータが不足しています' });
    return;
  }

  try {
    // 既存データの確認
    const existingResult = await pool!.query(
      'SELECT id FROM pl_data WHERE store_id = $1 AND year = $2 AND month = $3',
      [storeId, year, month]
    );

    if (existingResult.rows.length > 0) {
      // 更新
      await pool!.query(
        `UPDATE pl_data
         SET data = $1, updated_at = NOW(), updated_by = $2
         WHERE store_id = $3 AND year = $4 AND month = $5`,
        [JSON.stringify(data || {}), user.id, storeId, year, month]
      );
    } else {
      // 新規作成
      await pool!.query(
        `INSERT INTO pl_data (store_id, year, month, data, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [storeId, year, month, JSON.stringify(data || {}), user.id, user.id]
      );
    }

    res.json({ success: true, message: 'P&Lデータを保存しました' });
  } catch (err) {
    console.error('P&Lデータ保存エラー:', err);
    res.status(500).json({ success: false, error: 'P&Lデータの保存に失敗しました' });
  }
});

// HTTPサーバーの作成
const server = http.createServer(app);

// WebSocketサーバーの初期化
let wsManager: WebSocketManager | null = null;
if (pool) {
  try {
    wsManager = new WebSocketManager(server, pool);
    console.log('✅ WebSocketサーバー初期化成功');
  } catch (err) {
    console.error('❌ WebSocketサーバー初期化失敗:', err);
  }
} else {
  console.log('⚠️  WebSocketサーバーはデータベース接続なしでは起動できません');
}

// サーバーの起動
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 
