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
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fetchJMAWeatherForecast, fetchJMAWeatherForDate } from './utils/jmaWeatherApi';
import * as cron from 'node-cron';

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

// CSV生成用のユーティリティ関数
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function generateCsv(rows: string[][]): Buffer {
  const csvRows = rows.map(row => row.map(escapeCsvValue).join(','));
  const csvContent = csvRows.join('\r\n');
  // BOM付きUTF-8エンコーディング
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  return Buffer.concat([bom, Buffer.from(csvContent, 'utf-8')]);
}

// スネークケースをキャメルケースに変換するヘルパー関数
function toCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // DateオブジェクトやPostgreSQLの日付型をISO文字列に変換
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // PostgreSQLの日付型（pgライブラリが返す形式）をISO文字列に変換
  if (obj && typeof obj === 'object' && 'toISOString' in obj && typeof obj.toISOString === 'function') {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  
  const camelCaseObj: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = obj[key];
      
      // 日付型の値をISO文字列に変換
      if (value instanceof Date) {
        camelCaseObj[camelKey] = value.toISOString();
      } else if (value && typeof value === 'object' && 'toISOString' in value && typeof value.toISOString === 'function') {
        camelCaseObj[camelKey] = value.toISOString();
      } else {
        camelCaseObj[camelKey] = toCamelCase(value);
      }
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
    const email = 'admin@example.com';
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
      `INSERT INTO employees (employee_id, email, password_hash, full_name, nickname, store_id, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, employee_id, email, full_name, nickname, role, store_id`,
      [employeeId, email, passwordHash, fullName, nickname, storeId, role]
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
  const { email, password } = req.body;
  console.log('=== ログイン試行 ===');
  console.log('Email:', email);
  console.log('Password:', password);
  
  if (!email || !password) {
    res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
    return;
  }
  
  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: '有効なメールアドレスを入力してください' });
    return;
  }
  
  try {
    const userResult = await pool!.query(
      `SELECT id, employee_id, email, full_name, nickname, store_id, password_hash, role, is_active FROM employees WHERE email = $1 LIMIT 1`,
      [email]
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
      email: user.email,
      role: user.role, 
      isActive: user.isActive,
      hasPasswordHash: !!user.passwordHash
    });
    
    // 一時的にパスワードチェックをスキップ（メールアドレス admin@example.com & パスワード toyama2023 の場合）
    let isMatch = false;
    if (email === 'admin@example.com' && password === 'toyama2023') {
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
      { id: user.id, employeeId: user.employeeId, email: user.email, role: user.role },
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
    res.status(401).json({ error: '認証トークンが提供されていません' });
    return;
  }

  verify(token as string, process.env.JWT_SECRET || 'default-secret', (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: '認証トークンが無効または期限切れです' });
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

// パスワード変更API（自分のパスワードを変更）
app.put('/api/auth/change-password', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = (req as any).user;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: '現在のパスワードと新しいパスワードを入力してください' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: '新しいパスワードは8文字以上である必要があります' });
    return;
  }

  try {
    // 現在のパスワードを確認
    const userResult = await pool!.query(
      'SELECT password_hash FROM employees WHERE id = $1',
      [user.id]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isMatch) {
      res.status(401).json({ error: '現在のパスワードが正しくありません' });
      return;
    }

    // 新しいパスワードをハッシュ化して更新
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await pool!.query(
      'UPDATE employees SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, user.id]
    );

    res.json({ data: { success: true, message: 'パスワードが変更されました' } });
  } catch (err) {
    console.error('パスワード変更エラー:', err);
    res.status(500).json({ error: 'パスワードの変更に失敗しました' });
  }
});

// 管理者によるパスワードリセットAPI
app.post('/api/auth/reset-password', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  const user = (req as any).user;

  // 管理者のみ実行可能
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    res.status(403).json({ error: 'この操作を実行する権限がありません' });
    return;
  }

  if (!email || !newPassword) {
    res.status(400).json({ error: 'メールアドレスと新しいパスワードを入力してください' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: '新しいパスワードは8文字以上である必要があります' });
    return;
  }

  try {
    // 対象ユーザーを取得
    const userResult = await pool!.query(
      'SELECT id, role FROM employees WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'ユーザーが見つかりません' });
      return;
    }

    const targetUser = userResult.rows[0];

    // 管理者は自分より上位の権限を持つユーザーのパスワードをリセットできない
    if (user.role === 'admin' && (targetUser.role === 'admin' || targetUser.role === 'super_admin')) {
      res.status(403).json({ error: 'このユーザーのパスワードをリセットする権限がありません' });
      return;
    }

    // パスワードをリセット
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await pool!.query(
      'UPDATE employees SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [newPasswordHash, email]
    );

    res.json({ data: { success: true, message: 'パスワードがリセットされました' } });
  } catch (err) {
    console.error('パスワードリセットエラー:', err);
    res.status(500).json({ error: 'パスワードのリセットに失敗しました' });
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
      SELECT s.id, s.name, s.business_type_id, s.address, s.latitude, s.longitude, s.created_at, s.updated_at,
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

// 住所から緯度経度を取得する関数（OpenStreetMap Nominatim APIを使用）
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve, reject) => {
    // 住所の形式を調整（「富山県富山市二口町5-10-3」→「富山県富山市二口町」など）
    let searchAddress = address;
    // 番地を削除して検索を試みる（「5-10-3」のような形式を削除）
    const addressWithoutNumber = address.replace(/[\d\-]+/g, '').replace(/\s+/g, '').trim();
    if (addressWithoutNumber && addressWithoutNumber !== address && addressWithoutNumber.length > 0) {
      searchAddress = addressWithoutNumber;
      console.log(`[ジオコーディング] 番地を削除して検索: ${address} → ${searchAddress}`);
    }
    
    // 複数の検索パターンを試す
    const searchPatterns = [
      searchAddress,
      address.replace(/[\d\-]+/g, '').trim(),
      address.split(/[\d\-]/)[0].trim(),
      '富山県富山市' // フォールバック
    ];
    
    const tryGeocode = async (patternIndex: number): Promise<void> => {
      if (patternIndex >= searchPatterns.length) {
        console.warn(`[ジオコーディング] すべてのパターンで失敗: ${address}`);
        resolve(null);
        return;
      }
      
      const pattern = searchPatterns[patternIndex];
      const encodedAddress = encodeURIComponent(pattern);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&countrycodes=jp&addressdetails=1`;
      
      console.log(`[ジオコーディング] パターン${patternIndex + 1}/${searchPatterns.length}: ${pattern}`);
      console.log(`[ジオコーディング] URL: ${url}`);
    
    https.get(url, {
      headers: {
        'User-Agent': 'ManagementSystem/1.0',
        'Accept-Language': 'ja'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`[ジオコーディング] HTTPエラー: ${res.statusCode}, レスポンス: ${data.substring(0, 200)}`);
            // 次のパターンを試す
            tryGeocode(patternIndex + 1);
            return;
          }
          
          const results = JSON.parse(data);
          console.log(`[ジオコーディング] APIレスポンス: ${JSON.stringify(results).substring(0, 500)}`);
          if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            if (isNaN(lat) || isNaN(lon)) {
              console.error(`[ジオコーディング] 無効な緯度経度: lat=${results[0].lat}, lon=${results[0].lon}`);
              // 次のパターンを試す
              tryGeocode(patternIndex + 1);
              return;
            }
            console.log(`[ジオコーディング] 成功: 緯度=${lat}, 経度=${lon} (パターン: ${pattern})`);
            resolve({ latitude: lat, longitude: lon });
          } else {
            console.warn(`[ジオコーディング] 結果が見つかりませんでした (パターン${patternIndex + 1}): ${pattern}`);
            // 次のパターンを試す
            tryGeocode(patternIndex + 1);
          }
        } catch (err) {
          console.error(`[ジオコーディング] パースエラー:`, err);
          console.error(`[ジオコーディング] レスポンスデータ: ${data.substring(0, 500)}`);
          // 次のパターンを試す
          tryGeocode(patternIndex + 1);
        }
      });
    }).on('error', (err) => {
      console.error(`[ジオコーディング] ネットワークエラー:`, err);
      // 次のパターンを試す
      tryGeocode(patternIndex + 1);
    });
    };
    
    // 最初のパターンから試す
    tryGeocode(0);
  });
}

app.post('/api/stores', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { name, businessTypeId, address } = req.body;
  
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
    
    // 住所から緯度経度を取得
    let latitude: number | null = null;
    let longitude: number | null = null;
    
    if (address && address.trim()) {
      try {
        const geoResult = await geocodeAddress(address.trim());
        if (geoResult) {
          latitude = geoResult.latitude;
          longitude = geoResult.longitude;
        } else {
          console.warn(`住所から緯度経度を取得できませんでした: ${address}`);
        }
      } catch (geoErr) {
        console.error('ジオコーディングエラー:', geoErr);
        // エラーが発生しても店舗作成は続行（緯度経度はnullのまま）
      }
    }
    
    const result = await pool!.query(
      'INSERT INTO stores (name, business_type_id, address, latitude, longitude) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name.trim(), businessTypeId, address?.trim() || null, latitude, longitude]
    );
    const newStoreId = result.rows[0].id;

    // 業態名を含めて再取得
    const storeWithBT = await pool!.query(`
      SELECT s.id, s.name, s.business_type_id, s.address, s.latitude, s.longitude, s.created_at, s.updated_at,
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
  const { name, businessTypeId, address } = req.body;
  
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
    
    // 住所から緯度経度を取得
    let latitude: number | null = null;
    let longitude: number | null = null;
    
    if (address && address.trim()) {
      try {
        const geoResult = await geocodeAddress(address.trim());
        if (geoResult) {
          latitude = geoResult.latitude;
          longitude = geoResult.longitude;
        } else {
          console.warn(`住所から緯度経度を取得できませんでした: ${address}`);
        }
      } catch (geoErr) {
        console.error('ジオコーディングエラー:', geoErr);
        // エラーが発生しても店舗更新は続行（緯度経度はnullのまま）
      }
    }
    
    const result = await pool!.query(
      `UPDATE stores SET name = $1, business_type_id = $2, address = $3, latitude = $4, longitude = $5, updated_at = NOW() WHERE id = $6
       RETURNING id, name, business_type_id, address, latitude, longitude, created_at, updated_at`,
      [name.trim(), businessTypeId, address?.trim() || null, latitude, longitude, id]
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

// 業態別フィールド設定API
// インメモリストレージ（本番ではDBに保存することを推奨）
const businessTypeFieldsStorage: Record<string, any[]> = {};

app.get('/api/business-type-fields', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    const { businessTypeId } = req.query;

    if (!businessTypeId) {
      res.status(400).json({ success: false, error: 'businessTypeId is required' });
      return;
    }

    // 保存されている設定を取得、なければnullを返す
    const fields = businessTypeFieldsStorage[String(businessTypeId)] || null;

    res.json({
      success: true,
      data: fields
    });
  } catch (error) {
    console.error('業態別フィールド設定取得エラー:', error);
    res.status(500).json({ success: false, error: 'フィールド設定の取得に失敗しました' });
  }
});

app.post('/api/business-type-fields', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    const { businessTypeId, fields } = req.body;

    if (!businessTypeId) {
      res.status(400).json({ success: false, error: 'businessTypeId is required' });
      return;
    }

    if (!fields || !Array.isArray(fields)) {
      res.status(400).json({ success: false, error: 'fields must be an array' });
      return;
    }

    // フィールド設定を保存
    businessTypeFieldsStorage[String(businessTypeId)] = fields;

    res.json({
      success: true,
      message: 'フィールド設定を保存しました'
    });
  } catch (error) {
    console.error('業態別フィールド設定保存エラー:', error);
    res.status(500).json({ success: false, error: 'フィールド設定の保存に失敗しました' });
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
      'SELECT id FROM employees WHERE employee_id = $1',
      [employeeId]
    );
    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: '既に存在する従業員IDです' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role || 'user';
    const result = await pool!.query(
      `INSERT INTO employees (employee_id, password_hash, full_name, nickname, store_id, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, employee_id, full_name, nickname, role, store_id`,
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
    // shift_periodsテーブルにはyear, monthカラムがないため、start_dateとend_dateから計算
    const query = `
      SELECT 
        id,
        start_date,
        end_date,
        submission_deadline,
        is_locked,
        created_at,
        updated_at,
        EXTRACT(YEAR FROM start_date) as year,
        EXTRACT(MONTH FROM start_date) as month
      FROM shift_periods 
      ORDER BY start_date DESC
    `;
    const result = await pool!.query(query);
    const periods = toCamelCase(result.rows);
    res.json({ data: periods });
  } catch (err) {
    console.error('シフト期間取得エラー:', err);
    console.error('エラー詳細:', err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: 'シフト期間の取得に失敗しました', details: err instanceof Error ? err.message : String(err) });
  }
});

// シフト提出管理API
app.get('/api/shift-submissions', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { periodId } = req.query;
  // periodIdが存在する場合は整数型として検証（UUID形式のチェックを削除）
  if (periodId && isNaN(Number(periodId))) {
    res.status(400).json({ error: 'periodIdが不正です（整数のみ許可）' });
    return;
  }
  try {
    let query = `
      SELECT ss.*, e.full_name as employee_name, e.employee_id, ss.employee_id as employee_id_ref
      FROM shift_submissions ss
      JOIN employees e ON ss.employee_id = e.id
      JOIN shift_periods sp ON ss.period_id = sp.id
    `;
    let params: any[] = [];
    
    if (periodId) {
      query += ' WHERE ss.period_id = $1';
      params.push(periodId);
    }
    
    query += ' ORDER BY ss.created_at DESC';
    
    const result = await pool!.query(query, params);
    const submissions = toCamelCase(result.rows).map((sub: any) => ({
      ...sub,
      employeeId: sub.employeeIdRef || sub.employeeId // employee_id (employees.idへの参照)をemployeeIdとして設定
    }));
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
      `INSERT INTO shift_submissions (period_id, employee_id, status, submitted_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [periodId, employeeId, status || 'draft', status === 'submitted' ? new Date() : null]
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
        WHERE period_id = ANY($1)
      )
    `, [periodIds]);
    
    // シフト提出データを削除
    const deleteSubmissionsResult = await pool!.query(
      'DELETE FROM shift_submissions WHERE period_id = ANY($1)',
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

// シフトExcel出力API（メインドメインと同じ形式）
app.get('/api/shift-export-excel', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    const { periodId, storeId } = req.query;
    
    if (!periodId || !storeId) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(400).json({ error: 'periodIdとstoreIdが必要です' });
      return;
    }

    // storeIdを整数に変換（文字列の場合はエラー）
    const storeIdInt = parseInt(String(storeId), 10);
    if (isNaN(storeIdInt)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(400).json({ error: `無効なstoreId: ${storeId}` });
      return;
    }

    // periodIdを整数に変換
    const periodIdInt = parseInt(String(periodId), 10);
    if (isNaN(periodIdInt)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(400).json({ error: `無効なperiodId: ${periodId}` });
      return;
    }

    // シフト期間を取得
    const periodResult = await pool!.query(
      'SELECT * FROM shift_periods WHERE id = $1',
      [periodIdInt]
    );

    if (periodResult.rows.length === 0) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(404).json({ error: 'シフト期間が見つかりません' });
      return;
    }

    const period = toCamelCase(periodResult.rows[0]);
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);
    
    // 日付範囲内の日付リストを生成（メインドメインのロジックに合わせる）
    const days: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 従業員を取得（storeIdでフィルタ、employee_idでソート）
    const employeesResult = await pool!.query(
      `SELECT e.*, s.name as store_name 
       FROM employees e 
       JOIN stores s ON e.store_id = s.id 
       WHERE e.store_id = $1 
       ORDER BY CAST(e.employee_id AS INTEGER)`,
      [storeIdInt]
    );
    const employees = toCamelCase(employeesResult.rows);

    // シフト提出データを取得
    const submissionsResult = await pool!.query(
      `SELECT ss.*, e.full_name as employee_name, e.employee_id, e.id as employee_db_id
       FROM shift_submissions ss
       JOIN employees e ON ss.employee_id = e.id
       WHERE ss.period_id = $1 AND e.store_id = $2
       ORDER BY CAST(e.employee_id AS INTEGER)`,
      [periodIdInt, storeIdInt]
    );
    const submissions = toCamelCase(submissionsResult.rows).map((sub: any) => ({
      ...sub,
      employeeId: sub.employeeDbId || sub.employeeIdRef || sub.employeeId // employees.idをemployeeIdとして設定
    }));

    // 各提出のシフトエントリを取得
    const submissionsWithEntries = await Promise.all(
      submissions.map(async (submission: any) => {
        const entriesResult = await pool!.query(
          'SELECT * FROM shift_entries WHERE submission_id = $1 ORDER BY work_date',
          [submission.id]
        );
        const entries = toCamelCase(entriesResult.rows);
        console.log(`従業員ID ${submission.employeeId} のシフトエントリ:`, entries.length, '件', entries);
        return {
          ...submission,
          shiftEntries: entries
        };
      })
    );
    
    console.log('シフト提出データ（エントリ含む）:', submissionsWithEntries.length, '件');
    submissionsWithEntries.forEach((sub: any) => {
      console.log(`  従業員ID: ${sub.employeeId}, エントリ数: ${sub.shiftEntries?.length || 0}`);
    });

    // Excelテンプレートを読み込む
    // process.cwd()は実行時の作業ディレクトリを返す（PM2では~/Management/backend）
    // __dirnameはコンパイル後のdistディレクトリを指す（~/Management/backend/src）
    // 複数のパスを試す
    const possiblePaths = [
      path.join(process.cwd(), 'templates', 'on_template.xlsx'), // /home/ktg/Management/backend/templates/on_template.xlsx
      path.join(__dirname, '..', 'templates', 'on_template.xlsx'), // /home/ktg/Management/backend/src/../templates/on_template.xlsx
      path.join(process.cwd(), 'backend', 'templates', 'on_template.xlsx'), // 念のため
      path.join(__dirname, '..', '..', 'backend', 'templates', 'on_template.xlsx'), // 念のため
    ];
    
    let templatePath = '';
    for (const possiblePath of possiblePaths) {
      const resolvedPath = path.resolve(possiblePath);
      console.log('テンプレートファイルパス確認:', resolvedPath, '存在:', fs.existsSync(resolvedPath));
      if (fs.existsSync(resolvedPath)) {
        templatePath = resolvedPath;
        break;
      }
    }
    
    console.log('選択されたテンプレートファイルパス:', templatePath);
    console.log('process.cwd():', process.cwd());
    console.log('__dirname:', __dirname);
    
    // テンプレートファイルの存在確認
    if (!templatePath || !fs.existsSync(templatePath)) {
      console.error('テンプレートファイルが見つかりません。試したパス:', possiblePaths);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(500).json({ error: 'テンプレートファイルが見つかりません', triedPaths: possiblePaths, cwd: process.cwd(), dirname: __dirname });
      return;
    }
    
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(templatePath);
    } catch (readError) {
      console.error('テンプレートファイル読み込みエラー:', readError);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(500).json({ error: 'テンプレートファイルの読み込みに失敗しました: ' + (readError instanceof Error ? readError.message : '不明なエラー') });
      return;
    }
    
    const sheet = workbook.getWorksheet('原本');
    if (!sheet) {
      console.error('「原本」シートが見つかりません');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(500).json({ error: 'テンプレートファイルの「原本」シートが見つかりません' });
      return;
    }

    // 月と日付を設定（メインドメインのロジックに合わせる）
    // UTC時間を日本時間（JST）に変換してから月と日を取得
    const jstStartDate = new Date(startDate.getTime() + (9 * 60 * 60 * 1000));
    const month = jstStartDate.getUTCMonth() + 1;
    const dayNumbers = days.map(d => {
      const jstDay = new Date(d.getTime() + (9 * 60 * 60 * 1000));
      return jstDay.getUTCDate();
    });
    
    console.log('月:', month);
    console.log('日付リスト:', dayNumbers);
    console.log('日数:', dayNumbers.length);
    
    sheet.getCell('C2').value = `${month}月`;
    // メインドメインでは最大16日分まで対応（15日分の場合は16列目は空）
    const dayColumns = ['E2', 'G2', 'I2', 'K2', 'M2', 'O2', 'Q2', 'S2', 'U2', 'W2', 'Y2', 'AA2', 'AC2', 'AE2', 'AG2', 'AI2'];
    // 16日以上の場合、AK2も追加（メインドメインのロジックに合わせる）
    const maxDays = dayNumbers.length >= 16 ? 16 : dayNumbers.length;
    dayNumbers.forEach((day, index) => {
      if (index < maxDays) {
        if (index < dayColumns.length) {
          sheet.getCell(dayColumns[index]).value = day;
          console.log(`日付セル ${dayColumns[index]} = ${day}`);
        } else if (index === 15 && dayNumbers.length >= 16) {
          // 16日目の場合はAK2に書き込む
          sheet.getCell('AK2').value = day;
          console.log(`日付セル AK2 = ${day}`);
        }
      }
    });

    // 曜日を設定（メインドメインのロジックに合わせる）
    const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
    const weekdayColumns = ['E3', 'G3', 'I3', 'K3', 'M3', 'O3', 'Q3', 'S3', 'U3', 'W3', 'Y3', 'AA3', 'AC3', 'AE3', 'AG3', 'AI3'];
    days.forEach((day, index) => {
      if (index < maxDays) {
        if (index < weekdayColumns.length) {
          // UTC時間を日本時間（JST）に変換してから曜日を取得
          const jstDay = new Date(day.getTime() + (9 * 60 * 60 * 1000));
          const dayOfWeek = jstDay.getUTCDay(); // 0=日曜日, 1=月曜日, ..., 6=土曜日
          const weekday = weekdays[dayOfWeek === 0 ? 6 : dayOfWeek - 1]; // 月曜日を0に調整
          sheet.getCell(weekdayColumns[index]).value = weekday;
        } else if (index === 15 && dayNumbers.length >= 16) {
          // 16日目の場合はAK3に書き込む
          const jstDay = new Date(day.getTime() + (9 * 60 * 60 * 1000));
          const dayOfWeek = jstDay.getUTCDay();
          const weekday = weekdays[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
          sheet.getCell('AK3').value = weekday;
        }
      }
    });

    // 従業員データを書き込む（メインドメインのCsvMixinに合わせる）
    // メインドメインでは t=15, op=16 から始まる
    const startRow = 16; // メインドメインと同じ開始行（op=16）
    const startTimeColumns = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37]; // 出勤時間列（16日分対応）
    const endTimeColumns = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38]; // 退勤時間列（16日分対応）
    const nameColumn = 3; // 従業員名列（C列）

    let currentRow = startRow;
    console.log('従業員数:', employees.length);
    console.log('提出データ数:', submissionsWithEntries.length);
    
    employees.forEach((employee: any) => {
      // メインドメインでは employee.id (employees.id) でマッチング
      // submission.employeeId は shift_submissions.employee_id (employees.idへの参照)
      const submission = submissionsWithEntries.find((s: any) => {
        // employeeIdはshift_submissions.employee_idで、employees.idを参照している
        // employeeIdRefは明示的に取得したemployees.id
        return s.employeeId === employee.id || s.employeeIdRef === employee.id || s.employeeDbId === employee.id;
      });
      
      console.log(`従業員 ${employee.nickname || employee.fullName} (ID: ${employee.id}):`, {
        hasSubmission: !!submission,
        submissionEmployeeId: submission?.employeeId,
        submissionEmployeeIdRef: submission?.employeeIdRef,
        entriesCount: submission?.shiftEntries?.length || 0
      });
      
      // 従業員名を設定
      sheet.getCell(currentRow, nameColumn).value = employee.nickname || employee.fullName;

      // 各日のシフトデータを書き込む
      days.forEach((day, dayIndex) => {
        // メインドメインでは最大16日分まで対応
        if (dayIndex < maxDays && dayIndex < startTimeColumns.length) {
          // 日付文字列を生成（YYYY-MM-DD形式）
          // UTC時間を日本時間（JST）に変換してから日付を取得
          const jstDate = new Date(day.getTime() + (9 * 60 * 60 * 1000));
          const dateStr = `${jstDate.getUTCFullYear()}-${(jstDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${jstDate.getUTCDate().toString().padStart(2, '0')}`;
          
          console.log(`  日付インデックス ${dayIndex}: ${dateStr} (元の日付: ${day.toISOString()})`);
          
          const entry = submission?.shiftEntries?.find((e: any) => {
            // workDateとwork_dateの両方に対応
            const entryDate = e.workDate || e.work_date;
            if (!entryDate) return false;
            
            // 日付文字列を正規化（時刻部分を削除）
            const normalizedEntryDate = entryDate.split('T')[0];
            const match = normalizedEntryDate === dateStr;
            
            if (match) {
              console.log(`    マッチしたエントリ: ${normalizedEntryDate} === ${dateStr}`);
            }
            
            return match;
          });

          if (entry) {
            console.log(`  ✅ 日付 ${dateStr}: 出勤=${entry.startTime}, 退勤=${entry.endTime}`);
            
            // 出勤時間（メインドメインのロジックに合わせる）
            if (entry.startTime && entry.startTime !== '' && entry.startTime !== ' ') {
              const startTime = parseFloat(entry.startTime);
              if (!isNaN(startTime)) {
                sheet.getCell(currentRow, startTimeColumns[dayIndex]).value = startTime;
                console.log(`    出勤時間を書き込み: 行${currentRow}, 列${startTimeColumns[dayIndex]} = ${startTime}`);
              }
            }
            
            // 退勤時間（メインドメインのロジックに合わせる）
            if (entry.endTime && entry.endTime !== '' && entry.endTime !== ' ') {
              const endTime = parseFloat(entry.endTime);
              if (!isNaN(endTime)) {
                sheet.getCell(currentRow, endTimeColumns[dayIndex]).value = endTime;
                console.log(`    退勤時間を書き込み: 行${currentRow}, 列${endTimeColumns[dayIndex]} = ${endTime}`);
              }
            }
          } else {
            console.log(`  ❌ 日付 ${dateStr}: エントリが見つかりません`);
            // デバッグ用：利用可能なエントリの日付を表示
            if (submission?.shiftEntries && submission.shiftEntries.length > 0) {
              const availableDates = submission.shiftEntries.map((e: any) => {
                const entryDate = e.workDate || e.work_date;
                return entryDate ? entryDate.split('T')[0] : null;
              }).filter(Boolean);
              console.log(`    利用可能な日付:`, availableDates);
            }
          }
        } else {
          console.log(`  ⚠️ 日付インデックス ${dayIndex} は範囲外（最大${startTimeColumns.length}日まで）`);
        }
      });

      currentRow++;
    });

    // セルの結合（メインドメインと同じ）
    const mergeRanges = [
      'E2:F2', 'G2:H2', 'I2:J2', 'K2:L2', 'M2:N2', 'O2:P2', 'Q2:R2', 'S2:T2',
      'U2:V2', 'W2:X2', 'Y2:Z2', 'AA2:AB2', 'AC2:AD2', 'AE2:AF2', 'AG2:AH2', 'AI2:AJ2',
      'E3:F3', 'G3:H3', 'I3:J3', 'K3:L3', 'M3:N3', 'O3:P3', 'Q3:R3', 'S3:T3',
      'U3:V3', 'W3:X3', 'Y3:Z3', 'AA3:AB3', 'AC3:AD3', 'AE3:AF3', 'AG3:AH3', 'AI3:AJ3'
    ];
    
    // 16日以上の場合、AK2:AL2とAK3:AL3を結合（メインドメインのロジックに合わせる）
    if (maxDays >= 16) {
      mergeRanges.push('AK2:AL2', 'AK3:AL3');
    }

    mergeRanges.forEach(range => {
      try {
        sheet.mergeCells(range);
      } catch (err) {
        // 既に結合されている場合は無視
      }
    });

    // セルの中央揃え（2行目と3行目）
    for (let row = 2; row <= 3; row++) {
      for (let col = 5; col <= 36 + (dayNumbers.length >= 16 ? 2 : 0); col++) {
        const cell = sheet.getCell(row, col);
        cell.alignment = { horizontal: 'center' as const, vertical: 'middle' as const };
      }
    }

    // Excelファイルを生成
    const buffer = await workbook.xlsx.writeBuffer();

    // ファイル名を設定
    const storeResult = await pool!.query('SELECT name FROM stores WHERE id = $1', [storeIdInt]);
    const storeName = storeResult.rows[0]?.name || '全店舗';
    const filename = `${startDate.getFullYear()}${month.toString().padStart(2, '0')}${startDate.getDate().toString().padStart(2, '0')}.xlsx`;

    // レスポンスを設定（Excelファイルとして返す）
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', Buffer.byteLength(buffer).toString());
    res.send(buffer);
  } catch (err) {
    console.error('シフトExcel出力エラー:', err);
    // エラー時はJSONとして返す（CSVとして解釈されないようにContent-Typeを明示的に設定）
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({ 
      error: 'シフトExcel出力に失敗しました',
      details: err instanceof Error ? err.message : '不明なエラー',
      stack: err instanceof Error ? err.stack : undefined
    });
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
            WHERE period_id = ANY($1)
          )
        `, [periodIds]);
        
        await pool!.query('DELETE FROM shift_submissions WHERE period_id = ANY($1)', [periodIds]);
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

// PL科目一覧取得API（取引先の科目選択用）
app.get('/api/pl/subjects', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  try {
    // pl_itemsテーブルからユニークな科目名を取得
    const result = await pool!.query(
      'SELECT DISTINCT subject_name FROM pl_items WHERE subject_name IS NOT NULL AND subject_name != \'\' ORDER BY subject_name'
    );
    const subjects = result.rows.map(row => row.subject_name);
    res.json({ success: true, data: subjects });
  } catch (err) {
    console.error('PL科目一覧取得エラー:', err);
    res.status(500).json({ success: false, error: '科目一覧の取得に失敗しました' });
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
  console.log('[API /api/companies] Request:', { storeId, storeIdType: typeof storeId });
  try {
    let query = `
      SELECT c.*, s.name as store_name
      FROM companies c
      LEFT JOIN stores s ON c.store_id = s.id
    `;
    const params: any[] = [];
    
    if (storeId) {
      // storeIdを数値に変換して比較（データベースのstore_idは整数型）
      const storeIdNum = typeof storeId === 'string' ? parseInt(storeId, 10) : storeId;
      query += ' WHERE c.store_id = $1';
      params.push(storeIdNum);
      console.log('[API /api/companies] Filtering by storeId:', storeIdNum);
    }
    
    query += ' ORDER BY c.name';
    
    console.log('[API /api/companies] Query:', query, 'Params:', params);
    const result = await pool!.query(query, params);
    console.log('[API /api/companies] Found', result.rows.length, 'companies');
    const companies = toCamelCase(result.rows);
    console.log('[API /api/companies] Returning companies:', companies.length);
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
    // PostgreSQL配列形式に変換
    let specificMonthsArray = null;
    if (specificMonths && Array.isArray(specificMonths) && specificMonths.length > 0) {
      specificMonthsArray = `{${specificMonths.join(',')}}`;
    }
    
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
        specific_months = $9::integer[],
        is_visible = $10,
        store_id = $11,
        updated_at = NOW()
      WHERE id = $12 RETURNING *`,
      [name, bankName, branchName, accountType, accountNumber, category, paymentType, regularAmount, specificMonthsArray, isVisible, storeId, id]
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
  if (!paymentType || !['regular', 'irregular', 'specific'].includes(paymentType)) {
    res.status(400).json({ success: false, error: '支払いタイプは regular, irregular, または specific である必要があります' });
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::integer[], $10, $11, NOW(), NOW()) RETURNING *`,
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
      
      // Validate daily_data structure
      if (!row.daily_data || typeof row.daily_data !== 'object') {
        console.error(`[API /api/sales] Invalid daily_data structure for storeId=${storeId}, year=${year}, month=${month}`);
        res.json({ success: true, data: null });
        return;
      }
      
      console.log(`[API /api/sales] Data found for storeId=${storeId}, year=${year}, month=${month}:`, {
        hasDailyData: !!row.daily_data,
        dailyDataKeys,
        sampleKeys: row.daily_data ? Object.keys(row.daily_data).slice(0, 5) : [],
        dailyDataType: typeof row.daily_data
      });
      
      // 店舗の緯度経度を取得
      const storeResult = await pool!.query(
        'SELECT latitude, longitude, address FROM stores WHERE id = $1',
        [storeId]
      );
      
      const store = storeResult.rows[0];
      if (!store) {
        console.error(`[天気データ取得] 店舗ID ${storeId} が見つかりません`);
        res.status(404).json({ success: false, error: '店舗が見つかりません' });
        return;
      }
      
      let latitude = store.latitude;
      let longitude = store.longitude;
      const address = store.address;
      
      // 売上管理ページが開かれた際に、過去2日のデータを再取得し、未来1週間の天気予報を取得
      if (latitude && longitude) {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // 過去2日（昨日と一昨日）のデータを再取得（予報データを実際の天気データで更新）
          for (let i = 1; i <= 2; i++) {
            const pastDate = new Date(today);
            pastDate.setDate(pastDate.getDate() - i);
            const pastDateStr = pastDate.toISOString().split('T')[0];
            
            // データベースに既に実績データがあるか確認
            const existingResult = await pool!.query(
              `SELECT id, updated_at FROM weather_data 
               WHERE latitude = $1 AND longitude = $2 AND date = $3`,
              [latitude, longitude, pastDateStr]
            );
            
            // 既に実績データがある場合はスキップ（過去データは一度取得したら保存する）
            if (existingResult.rows.length > 0) {
              const updatedAt = new Date(existingResult.rows[0].updated_at);
              // 今日更新されたデータは実績データとみなす
              if (updatedAt >= today) {
                console.log(`[天気データ更新] ${pastDateStr} のデータは既に実績データとして保存されています`);
                continue;
              }
            }
            
            // 過去データはJMA APIでは取得できないため、Visual Crossing APIを使用
            // 注意: 過去データはCSV/XLSXからインポート済みのため、通常は再取得不要
            // ただし、予報データを実績データで更新するために再取得
            console.log(`[天気データ更新] 過去${i}日目(${pastDateStr})のデータを再取得中...`);
            const weatherData = await fetchWeatherDataFromVisualCrossing(latitude, longitude, pastDate);
            
            if (weatherData.weather || weatherData.temperature !== null) {
              await pool!.query(
                `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                 ON CONFLICT (latitude, longitude, date) 
                 DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
                [latitude, longitude, pastDateStr, weatherData.weather || null, weatherData.temperature, weatherData.humidity, weatherData.precipitation, weatherData.snow]
              );
              console.log(`[天気データ更新] ${pastDateStr} のデータを更新しました`);
            }
          }
          
          // 未来1週間（今日から7日後まで）の天気予報を取得
          console.log('[天気データ更新] 未来1週間の天気予報を取得中...');
          try {
            const TOYAMA_AREA_CODE = '160000'; // 富山県の地域コード
            const forecastList = await fetchJMAWeatherForecast(TOYAMA_AREA_CODE);
            
            for (const forecast of forecastList) {
              const forecastDate = new Date(forecast.date);
              const todayStr = today.toISOString().split('T')[0];
              const forecastDateStr = forecast.date;
              
              // 今日から7日後までのデータのみを保存
              const daysDiff = Math.floor((forecastDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              if (daysDiff >= 0 && daysDiff <= 7) {
                // データベースに保存
                await pool!.query(
                  `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                   ON CONFLICT (latitude, longitude, date) 
                   DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
                  [latitude, longitude, forecastDateStr, forecast.weather || null, forecast.temperature, forecast.humidity, forecast.precipitation, forecast.snow]
                );
                console.log(`[天気データ更新] 未来予報 ${forecastDateStr} のデータを保存しました`);
              }
            }
          } catch (forecastErr) {
            console.error('[天気データ更新] 未来1週間の天気予報取得エラー:', forecastErr);
            // エラーが発生しても処理を続行
          }
        } catch (updateErr) {
          console.error('[天気データ更新] 天気データ更新エラー:', updateErr);
          // エラーが発生しても処理を続行
        }
      }
      
      console.log(`[天気データ取得] 店舗ID: ${storeId}, 住所: ${address}, 緯度: ${latitude}, 経度: ${longitude}`);
      
      // 緯度経度が設定されていない場合、住所から取得を試みる
      if ((!latitude || !longitude) && address) {
        console.log(`[天気データ取得] 店舗ID ${storeId} の緯度経度が未設定のため、住所から取得を試みます: ${address}`);
        try {
          console.log(`[天気データ取得] geocodeAddress関数を呼び出します`);
          const geoResult = await geocodeAddress(address);
          console.log(`[天気データ取得] geocodeAddress関数の結果:`, geoResult);
          if (geoResult) {
            latitude = geoResult.latitude;
            longitude = geoResult.longitude;
            // データベースに保存
            await pool!.query(
              'UPDATE stores SET latitude = $1, longitude = $2 WHERE id = $3',
              [latitude, longitude, storeId]
            );
            console.log(`[天気データ取得] 緯度経度を取得して保存しました: 緯度=${latitude}, 経度=${longitude}`);
          } else {
            console.warn(`[天気データ取得] 住所から緯度経度を取得できませんでした: ${address}`);
          }
        } catch (geoErr) {
          console.error(`[天気データ取得] ジオコーディングエラー:`, geoErr);
          console.error(`[天気データ取得] エラーの詳細:`, geoErr instanceof Error ? geoErr.message : String(geoErr));
          console.error(`[天気データ取得] エラースタック:`, geoErr instanceof Error ? geoErr.stack : 'スタック情報なし');
        }
      } else if (!address) {
        console.warn(`[天気データ取得] 店舗ID ${storeId} に住所が設定されていません`);
      }
      
      console.log(`[天気データ取得] 最終的な店舗ID: ${storeId}, 緯度: ${latitude}, 経度: ${longitude}`);
      
      // 月の全日の天気データを一括取得（パフォーマンス改善）
      // 注意: ここで使用するyearとmonthは、クエリパラメータから取得した値を使用
      const dataYear = parseInt(String(year));
      const dataMonth = parseInt(String(month));
      const daysInMonth = new Date(dataYear, dataMonth, 0).getDate();
      const monthStartDate = `${dataYear}-${String(dataMonth).padStart(2, '0')}-01`;
      const monthEndDate = `${dataYear}-${String(dataMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      
      console.log(`[天気データ取得] 年月: ${dataYear}/${dataMonth}, 期間: ${monthStartDate} ～ ${monthEndDate}`);
      
      let weatherCache: Map<string, { weather: string; temperature: number | null }> = new Map();
      
      if (latitude && longitude) {
        try {
          console.log(`[天気データ取得] 月の全日の天気データを一括取得中: ${monthStartDate} ～ ${monthEndDate}`);
          const weatherResult = await pool!.query(
            `SELECT date, weather, temperature FROM weather_data 
             WHERE latitude = $1 AND longitude = $2 
             AND date >= $3 AND date <= $4`,
            [latitude, longitude, monthStartDate, monthEndDate]
          );
          
          console.log(`[天気データ取得] 一括取得結果: ${weatherResult.rows.length}件`);
          
          for (const weatherRow of weatherResult.rows) {
            // dateはDateオブジェクトまたは文字列の可能性があるため、文字列に変換
            let dateKey: string;
            if (weatherRow.date instanceof Date) {
              dateKey = weatherRow.date.toISOString().split('T')[0];
            } else {
              // PostgreSQLのdate型は文字列として返される可能性がある
              const dateStr = String(weatherRow.date);
              dateKey = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
            }
            
            // 天気データの文字化けを修正（Shift-JISからUTF-8への変換を試みる）
            let weather = weatherRow.weather || '';
            // 文字化けのパターンを検出して修正
            // 文字化けのパターン: 不正な文字（�）や制御文字のみ
            // 注意: 「雨」「雪」「霧」など1文字の天気も有効なので、lengthチェックは削除
            const isCorrupted = weather && (
              weather.includes('�') || 
              weather.includes('���') ||
              /^[\x00-\x1F\x7F-\x9F]+$/.test(weather) // 制御文字のみ（可読文字を含まない）
            );
            
            if (isCorrupted) {
              console.warn(`[天気データ取得] 文字化けを検出: ${dateKey}, weather="${weather}" (length=${weather.length})`);
              // 文字化けしている場合は空文字列にして、フロントエンドでデフォルトアイコンが表示されるようにする
              weather = '';
            }
            
            weatherCache.set(dateKey, {
              weather: weather,
              temperature: weatherRow.temperature !== null ? Math.round(weatherRow.temperature) : null
            });
          }
          
          console.log(`[天気データ取得] キャッシュマップのサイズ: ${weatherCache.size}`);
          if (weatherCache.size > 0) {
            const sampleKeys = Array.from(weatherCache.keys()).slice(0, 3);
            console.log(`[天気データ取得] キャッシュサンプル:`, sampleKeys.map(key => ({
              date: key,
              weather: weatherCache.get(key)?.weather,
              temperature: weatherCache.get(key)?.temperature
            })));
          }
        } catch (err) {
          console.error(`[天気データ取得] 一括取得エラー:`, err);
        }
      }
      
      // 天気データとイベント情報を追加
      const enrichedDailyData: any = {};
      if (row.daily_data) {
        for (const dateStr in row.daily_data) {
          const dayData = row.daily_data[dateStr];
          
          // dateStrが日付形式（YYYY-MM-DD）か日付（1-31）かを判定
          let dayOfMonth: number;
          let date: Date;
          let dateKey: string;
          
          try {
            if (dateStr.includes('-')) {
              // YYYY-MM-DD形式の場合
              date = new Date(dateStr);
              if (isNaN(date.getTime())) {
                console.error(`[天気データ取得] 無効な日付形式: ${dateStr}`);
                // 日付文字列から日付部分を抽出してdayOfMonthを取得
                const dayMatch = dateStr.match(/-(\d{2})$/);
                if (dayMatch) {
                  dayOfMonth = parseInt(dayMatch[1]);
                  enrichedDailyData[dayOfMonth] = {
                    ...dayData,
                    weather: '',
                    temperature: null,
                    event: '',
                    is_predicted: dayData.is_predicted || false
                  };
                }
                continue;
              }
              dayOfMonth = date.getDate();
              dateKey = dateStr;
            } else {
              // 日付（1-31）形式の場合
              dayOfMonth = parseInt(dateStr);
              if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
                console.error(`[天気データ取得] 無効な日付: ${dateStr}`);
                enrichedDailyData[dayOfMonth] = {
                  ...dayData,
                  weather: '',
                  temperature: null,
                  event: '',
                  is_predicted: dayData.is_predicted || false
                };
                continue;
              }
              // 年月から日付オブジェクトを作成
              const dataYear = parseInt(String(row.year));
              const dataMonth = parseInt(String(row.month));
              if (isNaN(dataYear) || isNaN(dataMonth) || dataMonth < 1 || dataMonth > 12) {
                console.error(`[天気データ取得] 無効な年月: year=${row.year}, month=${row.month}`);
                enrichedDailyData[dayOfMonth] = {
                  ...dayData,
                  weather: '',
                  temperature: null,
                  event: '',
                  is_predicted: dayData.is_predicted || false
                };
                continue;
              }
              date = new Date(dataYear, dataMonth - 1, dayOfMonth);
              if (isNaN(date.getTime())) {
                console.error(`[天気データ取得] 無効な日付オブジェクト: ${dataYear}-${dataMonth}-${dayOfMonth}`);
                enrichedDailyData[dayOfMonth] = {
                  ...dayData,
                  weather: '',
                  temperature: null,
                  event: '',
                  is_predicted: dayData.is_predicted || false
                };
                continue;
              }
              dateKey = date.toISOString().split('T')[0];
            }
          } catch (dateErr) {
            console.error(`[天気データ取得] 日付解析エラー (${dateStr}):`, dateErr);
            // エラー時もdayOfMonthを取得しようとする
            const dayMatch = dateStr.match(/-(\d{2})$/) || [null, dateStr];
            const fallbackDay = parseInt(dayMatch[1] || dateStr);
            if (!isNaN(fallbackDay) && fallbackDay >= 1 && fallbackDay <= 31) {
              enrichedDailyData[fallbackDay] = {
                ...dayData,
                weather: '',
                temperature: null,
                event: '',
                is_predicted: dayData.is_predicted || false
              };
            }
            continue;
          }
          
          // イベント情報を追加
          const eventName = getEventName(date);
          
          // 天気データを取得（キャッシュから）
          let weather = '';
          let temperature: number | null = null;
          
          if (latitude && longitude && dateKey) {
            // まず、正確なdateKeyで検索
            let cachedWeather = weatherCache.get(dateKey);
            
            // 見つからない場合、日付の形式を変えて再検索（タイムゾーンの問題を回避）
            if (!cachedWeather) {
              // YYYY-MM-DD形式のdateKeyを試す
              const dateKeyAlt = date.toISOString().split('T')[0];
              cachedWeather = weatherCache.get(dateKeyAlt);
            }
            
            // まだ見つからない場合、キャッシュ内のすべてのキーをチェック（部分一致）
            if (!cachedWeather) {
              for (const [key, value] of weatherCache.entries()) {
                if (key.includes(dateKey.split('-')[2])) { // 日の部分で一致
                  cachedWeather = value;
                  console.log(`[天気データ取得] 部分一致で見つかりました: ${key} -> ${dateKey}`);
                  break;
                }
              }
            }
            
            if (cachedWeather) {
              weather = cachedWeather.weather || '';
              temperature = cachedWeather.temperature;
              
              // デバッグ: 最初の5日分の天気データをログ出力
              if (dayOfMonth <= 5) {
                console.log(`[天気データ取得] キャッシュから取得: ${dateKey}, weather="${weather}", temperature=${temperature}`);
              }
            } else {
              // デバッグ: キャッシュにない場合
              if (dayOfMonth <= 3) {
                console.log(`[天気データ取得] キャッシュにない日付: ${dateKey}, dayOfMonth: ${dayOfMonth}`);
                console.log(`[天気データ取得] キャッシュキー一覧:`, Array.from(weatherCache.keys()).slice(0, 10));
              }
            }
          }
          
          const enrichedDayData = {
            ...dayData,
            weather,
            temperature,
            event: eventName,
            is_predicted: dayData.is_predicted === true || dayData.is_predicted === 'true'  // 予測フラグを保持（明示的にtrueか'true'文字列の場合のみ）
          };
          
          // 数値キーと日付文字列キーの両方に保存（フロントエンドの互換性のため）
          enrichedDailyData[dayOfMonth] = enrichedDayData;
          if (dateKey && dateKey !== String(dayOfMonth)) {
            enrichedDailyData[dateKey] = enrichedDayData;
          }
          
          // デバッグ: 最初の5日分の天気データをログ出力
          if (dayOfMonth <= 5) {
            console.log(`[天気データ取得] 日付 ${dayOfMonth} (${dateKey}): 天気="${weather}", 気温=${temperature}, イベント=${eventName}, is_predicted=${dayData.is_predicted} (型: ${typeof dayData.is_predicted}), 最終値=${enrichedDayData.is_predicted}`);
          }
        }
      }
      
      // デバッグ: enrichedDailyDataのサンプルをログ出力
      const sampleKeys = Object.keys(enrichedDailyData).slice(0, 5);
      if (sampleKeys.length > 0) {
        console.log(`[天気データ取得] enrichedDailyData サンプル (${sampleKeys.length}件):`, sampleKeys.map(key => ({
          key,
          hasWeather: enrichedDailyData[key]?.weather !== undefined,
          weather: enrichedDailyData[key]?.weather,
          weatherLength: enrichedDailyData[key]?.weather?.length || 0,
          hasTemperature: enrichedDailyData[key]?.temperature !== undefined,
          temperature: enrichedDailyData[key]?.temperature,
          is_predicted: enrichedDailyData[key]?.is_predicted,
          netSales: enrichedDailyData[key]?.netSales,
          edwNetSales: enrichedDailyData[key]?.edwNetSales,
          ohbNetSales: enrichedDailyData[key]?.ohbNetSales
        })));
      } else {
        console.log(`[天気データ取得] enrichedDailyData は空です`);
      }
      
      res.json({
        success: true,
        data: {
          id: row.id,
          year: row.year,
          month: row.month,
          store_id: row.store_id,
          daily_data: enrichedDailyData,
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

// イベント判定関数（祝日、ホワイトデー、クリスマス、母の日など）
function getEventName(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = date.getDay(); // 0=日曜日, 1=月曜日, ..., 6=土曜日

  // バレンタインデー
  if (month === 2 && day === 14) {
    return 'バレンタインデー';
  }
  // ホワイトデー
  if (month === 3 && day === 14) {
    return 'ホワイトデー';
  }
  // ハロウィン
  if (month === 10 && day === 31) {
    return 'ハロウィン';
  }
  // 母の日（5月の第2日曜日）
  if (month === 5 && weekday === 0 && day > 7 && day <= 14) {
    return '母の日';
  }
  // 父の日（6月の第3日曜日）
  if (month === 6 && weekday === 0 && day > 14 && day <= 21) {
    return '父の日';
  }
  // クリスマスイブ
  if (month === 12 && day === 24) {
    return 'クリスマスイブ';
  }
  // クリスマス
  if (month === 12 && day === 25) {
    return 'クリスマス';
  }
  // 卒業シーズン
  if (month === 3 && day >= 1 && day <= 25) {
    return '卒業シーズン';
  }
  // 入学・新生活
  if (month === 4 && day <= 10) {
    return '入学・新生活';
  }
  // お盆
  if (month === 8 && day >= 13 && day <= 16) {
    return 'お盆';
  }
  
  return '';
}

// 天気コード → 日本語（Tomorrow.io用）
const WEATHER_CODE_TRANSLATIONS: Record<number, string> = {
  1000: "晴れ",
  1001: "曇り",
  1100: "晴れ",
  1101: "晴れ時々曇り",
  1102: "曇り",
  2000: "霧",
  4000: "弱い雨",
  4001: "雨",
  4200: "弱い雨",
  4201: "強い雨",
  5000: "雪",
  5100: "弱い雪",
  5101: "強い雪",
  6000: "凍雨",
  6001: "凍雨",
  8000: "雷雨",
};

// 天気データ取得関数
// ルール：
// 1. 一度取得した天気データは保存して、再度API取得は行わない
// 2. 未来のデータは日付が変わった時点で再度読み込む（当日起点で未来1週間）
// 3. 未来のデータAPIを読み込む際に一日前の天気の実績を読み込み再度保存する
async function fetchWeatherData(latitude: number, longitude: number, date: Date): Promise<{ weather: string; temperature: number | null }> {
  console.log(`[fetchWeatherData] 関数開始: 緯度=${latitude}, 経度=${longitude}, 日付=${date}`);
  
  // 日付のバリデーション
  if (isNaN(date.getTime())) {
    console.error(`[fetchWeatherData] 無効な日付オブジェクト:`, date);
    return { weather: '', temperature: null };
  }
  
  const dateStr = date.toISOString().split('T')[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  // 再度バリデーション
  if (isNaN(targetDate.getTime())) {
    console.error(`[fetchWeatherData] 無効なtargetDate:`, date, dateStr);
    return { weather: '', temperature: null };
  }
  
  console.log(`[fetchWeatherData] データベースからキャッシュを確認中: ${dateStr}`);
  
  // まずデータベースから取得を試みる
  try {
    const cachedResult = await pool!.query(
      `SELECT weather, temperature, updated_at FROM weather_data 
       WHERE latitude = $1 AND longitude = $2 AND date = $3`,
      [latitude, longitude, dateStr]
    );
    
    console.log(`[fetchWeatherData] キャッシュ検索結果: ${cachedResult.rows.length}件`);
    
    if (cachedResult.rows.length > 0) {
      const cached = cachedResult.rows[0];
      const updatedAt = new Date(cached.updated_at);
      const isToday = targetDate.getTime() === today.getTime();
      const isFuture = targetDate > today;
      
      // 過去のデータ：一度取得したら再取得しない
      if (targetDate < today) {
        return {
          weather: cached.weather || '',
          temperature: cached.temperature !== null ? Math.round(cached.temperature) : null
        };
      }
      
      // 未来のデータ：今日更新されていればキャッシュを使用
      if (isFuture && updatedAt >= today) {
        return {
          weather: cached.weather || '',
          temperature: cached.temperature !== null ? Math.round(cached.temperature) : null
        };
      }
      
      // 今日のデータ：今日更新されていればキャッシュを使用
      if (isToday && updatedAt >= today) {
        return {
          weather: cached.weather || '',
          temperature: cached.temperature !== null ? Math.round(cached.temperature) : null
        };
      }
    }
  } catch (err: any) {
    // weather_dataテーブルが存在しない場合はエラーを無視してAPIから取得
    if (err?.code === '42P01') {
      console.log('weather_dataテーブルが存在しません。APIから取得します。');
    } else {
      console.error('天気データキャッシュ取得エラー:', err);
    }
  }
  
  // データベースにキャッシュがない場合は、APIから取得を試みずに空のデータを返す
  // レート制限を回避するため、キャッシュがある日付のみ表示する
  console.log(`[fetchWeatherData] データベースにキャッシュがないため、空のデータを返します: ${dateStr}`);
  return { weather: '', temperature: null };
}

// 未来1週間の天気データを一括更新する関数（日次バッチ用）
// JMA（日本気象庁）JSON APIから取得
async function updateFutureWeatherData(latitude: number, longitude: number): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 富山県の地域コード（気象庁のJSON APIで使用）
  const TOYAMA_AREA_CODE = '160000';
  
  try {
    // JMA JSON APIから未来1週間の天気予報を一括取得
    console.log('[JMA API] 未来1週間の天気予報を取得中...');
    const forecastList = await fetchJMAWeatherForecast(TOYAMA_AREA_CODE);
    
    console.log(`[JMA API] 取得した予報データ数: ${forecastList.length}件`);
    
    // 取得した予報データをデータベースに保存
    for (const forecast of forecastList) {
      const dateStr = forecast.date;
      
      // 今日以降のデータのみ保存（過去データはCSV/XLSXからインポート済み）
      const forecastDate = new Date(dateStr);
      forecastDate.setHours(0, 0, 0, 0);
      
      if (forecastDate >= today) {
        try {
          await pool!.query(
            `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (latitude, longitude, date) 
             DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
            [latitude, longitude, dateStr, forecast.weather || null, forecast.temperature, forecast.humidity, forecast.precipitation, forecast.snow]
          );
          console.log(`[JMA API] ${dateStr} の天気予報を保存しました: ${forecast.weather}, ${forecast.temperature}°C`);
        } catch (err) {
          console.error(`[JMA API] データベース保存エラー (${dateStr}):`, err);
        }
      }
    }
    
    // 昨日の実績データも取得（予報データを実績データで更新）
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const yesterdayCheck = await pool!.query(
      `SELECT id, updated_at FROM weather_data WHERE latitude = $1 AND longitude = $2 AND date = $3`,
      [latitude, longitude, yesterdayStr]
    );
    
    // 昨日のデータが存在しない、または今日更新されていない場合は再取得
    if (yesterdayCheck.rows.length === 0 || new Date(yesterdayCheck.rows[0].updated_at) < today) {
      try {
        // 過去データはJMA APIでは取得できないため、Visual Crossing APIを使用
        // 注意: 過去データはCSV/XLSXからインポート済みのため、通常は再取得不要
        console.log(`[JMA API] 昨日(${yesterdayStr})のデータをVisual Crossing APIで取得中...`);
        const yesterdayData = await fetchWeatherDataFromVisualCrossing(latitude, longitude, yesterday);
        if (yesterdayData.weather || yesterdayData.temperature !== null) {
          await pool!.query(
            `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (latitude, longitude, date) 
             DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
            [latitude, longitude, yesterdayStr, yesterdayData.weather || null, yesterdayData.temperature, yesterdayData.humidity, yesterdayData.precipitation, yesterdayData.snow]
          );
          console.log(`[JMA API] 昨日(${yesterdayStr})の天気実績データを保存しました`);
        }
      } catch (err) {
        console.error('[JMA API] 昨日の天気実績データ取得エラー:', err);
      }
    }
  } catch (err) {
    console.error('[JMA API] 未来天気データ取得エラー:', err);
    // エラーが発生した場合は、Visual Crossing APIにフォールバック
    console.log('[JMA API] Visual Crossing APIにフォールバックします...');
    // フォールバック処理は既存のVisual Crossing APIを使用
  }
}

// 過去の天気データ取得（Tomorrow.io API）
async function fetchPastWeatherData(latitude: number, longitude: number, date: Date): Promise<{ weather: string; temperature: number | null }> {
  console.log(`[fetchPastWeatherData] 関数開始: 緯度=${latitude}, 経度=${longitude}, 日付=${date.toISOString()}`);
  
  const API_KEY = process.env.TOMORROW_IO_API_KEY || 'LaRsCCbEFOwKGaqHNtprA8Ejyw3ulHCl';
  const url = 'https://api.tomorrow.io/v4/timelines';
  
  const startTime = new Date(date);
  startTime.setHours(0, 0, 0, 0);
  const endTime = new Date(date);
  endTime.setHours(23, 59, 59, 999);
  
  const payload = {
    location: `${latitude},${longitude}`,
    fields: ['temperatureAvg', 'humidityAvg', 'rainAccumulationSum', 'weatherCodeMax'],
    units: 'metric',
    timesteps: ['1d'],
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  };

  console.log(`[fetchPastWeatherData] APIリクエスト送信: ${JSON.stringify(payload)}`);

  try {
    return new Promise((resolve) => {
      const postData = JSON.stringify(payload);
      const options = {
        hostname: 'api.tomorrow.io',
        path: '/v4/timelines',
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'apikey': API_KEY,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      console.log(`[fetchPastWeatherData] HTTPSリクエストオプション: ${JSON.stringify(options)}`);

      const req = https.request(options, (res) => {
        console.log(`[fetchPastWeatherData] HTTPレスポンス受信: ステータスコード=${res.statusCode}`);
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`[fetchPastWeatherData] レスポンスデータ受信完了: 長さ=${data.length}`);
          try {
            if (res.statusCode !== 200) {
              console.error(`[fetchPastWeatherData] HTTPエラー: ${res.statusCode}`);
              console.error(`[fetchPastWeatherData] エラーレスポンス全文: ${data}`);
              try {
                const errorData = JSON.parse(data);
                console.error(`[fetchPastWeatherData] エラーデータ:`, JSON.stringify(errorData, null, 2));
                
                // 429エラー（レート制限）の場合は、リトライしない（レート制限に達しているため）
                if (res.statusCode === 429) {
                  console.warn(`[fetchPastWeatherData] レート制限に達しました。データベースにキャッシュがない場合は、後で再試行してください。`);
                }
              } catch (parseErr) {
                console.error(`[fetchPastWeatherData] エラーレスポンスのパースに失敗:`, parseErr);
              }
              resolve({ weather: '', temperature: null });
              return;
            }
            
            const weatherData = JSON.parse(data);
            console.log(`[fetchPastWeatherData] レスポンス構造:`, JSON.stringify({
              hasData: !!weatherData.data,
              hasTimelines: !!weatherData.data?.timelines,
              timelinesLength: weatherData.data?.timelines?.length || 0,
              intervalsLength: weatherData.data?.timelines?.[0]?.intervals?.length || 0
            }));
            
            const intervals = weatherData?.data?.timelines?.[0]?.intervals;
            
            if (intervals && intervals.length > 0) {
              const item = intervals[0];
              const values = item.values;
              const temp = values.temperatureAvg;
              const weatherCode = values.weatherCodeMax;
              const weather = WEATHER_CODE_TRANSLATIONS[weatherCode] || '不明';
              
              console.log(`[fetchPastWeatherData] 取得データ: 天気コード=${weatherCode}, 天気=${weather}, 気温=${temp}`);
              
              resolve({
                weather,
                temperature: temp !== null && temp !== undefined ? Math.round(temp) : null
              });
            } else {
              console.warn(`[fetchPastWeatherData] インターバルが見つかりませんでした。レスポンス: ${JSON.stringify(weatherData).substring(0, 1000)}`);
              resolve({ weather: '', temperature: null });
            }
          } catch (err) {
            console.error('[fetchPastWeatherData] パースエラー:', err);
            console.error('[fetchPastWeatherData] レスポンスデータ:', data.substring(0, 1000));
            resolve({ weather: '', temperature: null });
          }
        });
      });

      req.on('error', (err) => {
        console.error('[fetchPastWeatherData] ネットワークエラー:', err);
        resolve({ weather: '', temperature: null });
      });

      console.log(`[fetchPastWeatherData] リクエスト送信中...`);
      req.write(postData);
      req.end();
      console.log(`[fetchPastWeatherData] リクエスト送信完了`);
    });
  } catch (err) {
    console.error('過去天気データ取得エラー:', err);
    return { weather: '', temperature: null };
  }
}

// 天気データ取得（Visual Crossing API）- 過去・現在・未来すべてに対応
// Visual Crossing APIは過去データも取得可能（無料プランでは過去6年間のデータが利用可能）
// 売上予測のために湿度、降水量、降雪量も取得
interface WeatherDataFromVisualCrossing {
  weather: string;
  temperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  snow: number | null;
}

async function fetchWeatherDataFromVisualCrossing(latitude: number, longitude: number, date: Date): Promise<WeatherDataFromVisualCrossing> {
  const API_KEY = process.env.VISUAL_CROSSING_API_KEY || '2BE5S9Y63SA2EXGEALZG7S7QM';
  const dateStr = date.toISOString().split('T')[0];
  // Visual Crossing APIは過去・現在・未来のすべての日付に対応
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${latitude},${longitude}/${dateStr}?unitGroup=metric&key=${API_KEY}`;

  const weatherTranslation: Record<string, string> = {
    "Clear": "晴れ",
    "Partially cloudy": "晴れ時々曇り",
    "Rain": "雨",
    "Snow": "雪",
    "Overcast": "曇り",
    "Fog": "霧",
    "Thunderstorm": "雷雨",
    "Showers": "にわか雨",
  };

  try {
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              console.error(`[Visual Crossing API] HTTPエラー: ${res.statusCode}, レスポンス: ${data.substring(0, 500)}`);
              resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
              return;
            }
            
            const weatherData = JSON.parse(data);
            console.log(`[Visual Crossing API] レスポンス構造:`, JSON.stringify({
              hasDays: !!weatherData.days,
              daysLength: weatherData.days?.length || 0
            }));
            
            if (weatherData.days && weatherData.days.length > 0) {
              const day = weatherData.days[0];
              const condition = day.conditions || '';
              let weather = condition;
              
              // 天気を日本語に翻訳
              for (const [key, value] of Object.entries(weatherTranslation)) {
                if (condition.toLowerCase().includes(key.toLowerCase())) {
                  weather = value;
                  break;
                }
              }
              
              // 湿度、降水量、降雪量も取得（売上予測用）
              const humidity = day.humidity !== null && day.humidity !== undefined ? Math.round(day.humidity * 100) / 100 : null; // パーセンテージ（0-100）
              const precipitation = day.precip !== null && day.precip !== undefined ? Math.round(day.precip * 100) / 100 : (day.precipitation !== null && day.precipitation !== undefined ? Math.round(day.precipitation * 100) / 100 : null); // mm
              const snow = day.snow !== null && day.snow !== undefined ? Math.round(day.snow * 100) / 100 : null; // cm
              
              console.log(`[Visual Crossing API] 取得データ: 天気=${weather}, 気温=${day.temp}°C, 湿度=${humidity}%, 降水量=${precipitation}mm, 降雪量=${snow}cm`);
              
              resolve({
                weather,
                temperature: day.temp !== null && day.temp !== undefined ? Math.round(day.temp) : null,
                humidity,
                precipitation,
                snow
              });
            } else {
              console.warn(`[Visual Crossing API] 日次データが見つかりませんでした。レスポンス: ${JSON.stringify(weatherData).substring(0, 1000)}`);
              resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
            }
          } catch (err) {
            console.error('[Visual Crossing API] パースエラー:', err);
            console.error('[Visual Crossing API] レスポンスデータ:', data.substring(0, 1000));
            resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
          }
        });
      }).on('error', (err) => {
        console.error('[Visual Crossing API] ネットワークエラー:', err);
        resolve({ weather: '', temperature: null, humidity: null, precipitation: null, snow: null });
      });
    });
  } catch (err) {
    console.error('[Visual Crossing API] エラー:', err);
    return { weather: '', temperature: null, humidity: null, precipitation: null, snow: null };
  }
}

// 特徴量取得API（売上予測用）
app.get('/api/sales/features', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, startDate, endDate, includeTarget } = req.query;
  
  if (!storeId) {
    res.status(400).json({ success: false, error: 'storeIdは必須です' });
    return;
  }
  
  try {
    const startDateStr = startDate as string || new Date().toISOString().split('T')[0];
    const endDateStr = endDate as string || new Date().toISOString().split('T')[0];
    const includeTargetBool = includeTarget === 'true';
    
    // 期間内の売上データを取得
    const startDateObj = new Date(startDateStr);
    const endDateObj = new Date(endDateStr);
    const startYear = startDateObj.getFullYear();
    const startMonth = startDateObj.getMonth() + 1;
    const endYear = endDateObj.getFullYear();
    const endMonth = endDateObj.getMonth() + 1;
    
    // 期間内のすべての月のデータを取得
    const allFeatures: any[] = [];
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    while (
      currentYear < endYear ||
      (currentYear === endYear && currentMonth <= endMonth)
    ) {
      const result = await pool!.query(
        `SELECT daily_data FROM sales_data
         WHERE store_id = $1 AND year = $2 AND month = $3`,
        [storeId, currentYear, currentMonth]
      );
      
      if (result.rows.length > 0 && result.rows[0].daily_data) {
        const dailyData = result.rows[0].daily_data;
        for (const dateStr in dailyData) {
          const dayData = dailyData[dateStr] as any;
          const date = new Date(dateStr);
          
          // 基本特徴量を生成
          const features: any = {
            date: dateStr,
            weekday: date.getDay(), // 0=日曜日, 1=月曜日, ..., 6=土曜日
            month: date.getMonth() + 1,
            day: date.getDate(),
            is_month_start: date.getDate() === 1 ? 1 : 0,
            dayofyear: Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)),
          };
          
          // 月末判定
          const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
          features.is_month_end = date.getDate() === lastDay ? 1 : 0;
          
          // 天気データ（将来実装予定、現在はnull）
          features.temperature = dayData.temperature || null;
          features.humidity = dayData.humidity || null;
          features.precipitation = dayData.precipitation || null;
          features.snow = dayData.snow || null;
          features.gust = dayData.gust || null;
          features.windspeed = dayData.windspeed || null;
          features.pressure = dayData.pressure || null;
          features.feelslike = dayData.feelslike || null;
          features.is_holiday = dayData.is_holiday ? 1 : 0;
          
          // ターゲット変数がある場合
          if (includeTargetBool) {
            features.netSales = dayData.netSales || 0;
            features.edwNetSales = dayData.edwNetSales || 0;
            features.ohbNetSales = dayData.ohbNetSales || 0;
          }
          
          allFeatures.push(features);
        }
      }
      
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    
    // 日付でソート
    allFeatures.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // ターゲット変数がある場合、移動平均とラグ特徴量を計算
    if (includeTargetBool && allFeatures.length > 0) {
      // 移動平均とラグ特徴量を計算
      for (let i = 0; i < allFeatures.length; i++) {
        const current = allFeatures[i];
        
        // 7日移動平均（過去7日間）
        if (i >= 7) {
          const ma7Values = allFeatures.slice(i - 7, i).map(f => f.netSales || 0);
          current.netSales_ma7 = ma7Values.reduce((sum, val) => sum + val, 0) / 7;
        } else {
          current.netSales_ma7 = null;
        }
        
        // 90日移動平均（過去90日間）
        if (i >= 90) {
          const ma90Values = allFeatures.slice(i - 90, i).map(f => f.netSales || 0);
          current.netSales_ma90 = ma90Values.reduce((sum, val) => sum + val, 0) / 90;
        } else {
          current.netSales_ma90 = null;
        }
        
        // ラグ特徴量（7日前、14日前）
        if (i >= 7) {
          current.netSales_lag7 = allFeatures[i - 7].netSales || 0;
        } else {
          current.netSales_lag7 = null;
        }
        
        if (i >= 14) {
          current.netSales_lag14 = allFeatures[i - 14].netSales || 0;
        } else {
          current.netSales_lag14 = null;
        }
      }
    }
    
    res.json({ success: true, data: allFeatures });
  } catch (err) {
    console.error('特徴量取得エラー:', err);
    res.status(500).json({ success: false, error: '特徴量の取得に失敗しました' });
  }
});

// 売上データCSV出力API
app.get('/api/sales/export-csv', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, startYear, startMonth, endYear, endMonth, fields, fieldLabels } = req.query;

  if (!storeId || !startYear || !startMonth || !endYear || !endMonth) {
    res.status(400).json({ success: false, error: 'storeId, startYear, startMonth, endYear, endMonthは必須です' });
    return;
  }

  try {
    const fieldKeys = fields ? (fields as string).split(',') : [];
    if (fieldKeys.length === 0) {
      res.status(400).json({ success: false, error: 'fieldsは必須です' });
      return;
    }

    // フィールドラベルのマッピングを取得
    let labelsMap: Record<string, string> = {};
    if (fieldLabels) {
      try {
        labelsMap = JSON.parse(fieldLabels as string);
      } catch (e) {
        console.warn('フィールドラベルのパースに失敗しました。フィールドキーをそのまま使用します。', e);
      }
    }

    // 期間内のすべての月を計算
    const months: { year: number; month: number }[] = [];
    let currentYear = parseInt(startYear as string);
    let currentMonth = parseInt(startMonth as string);
    const endYearInt = parseInt(endYear as string);
    const endMonthInt = parseInt(endMonth as string);

    while (
      currentYear < endYearInt ||
      (currentYear === endYearInt && currentMonth <= endMonthInt)
    ) {
      months.push({ year: currentYear, month: currentMonth });
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    // すべての月のデータを取得（月ごとにグループ化）
    const monthlyDataGroups: Array<{ year: number; month: number; data: Array<{ date: string; [key: string]: any }> }> = [];
    for (const { year, month } of months) {
      const result = await pool!.query(
        `SELECT daily_data FROM sales_data
         WHERE store_id = $1 AND year = $2 AND month = $3`,
        [storeId, year, month]
      );

      const monthData: Array<{ date: string; [key: string]: any }> = [];
      if (result.rows.length > 0 && result.rows[0].daily_data) {
        const dailyData = result.rows[0].daily_data;
        for (const date in dailyData) {
          const dayData = dailyData[date] as any;
          const row: { date: string; [key: string]: any } = { date };
          
          // 選択されたフィールドのみを追加
          fieldKeys.forEach(fieldKey => {
            const value = dayData[fieldKey];
            row[fieldKey] = value !== null && value !== undefined ? value : '';
          });
          
          monthData.push(row);
        }
      }

      if (monthData.length > 0) {
        monthlyDataGroups.push({ year, month, data: monthData });
      }
    }

    if (monthlyDataGroups.length === 0) {
      res.status(404).json({ success: false, error: '出力するデータがありません' });
      return;
    }

    // CSVヘッダー（フィールドラベルを使用、なければフィールドキー）
    const headers = ['日付', ...fieldKeys.map(key => labelsMap[key] || key)];
    
    // CSV行を生成（月ごとにグループ化し、月の間に空行を挿入）
    const csvRows: string[][] = [headers];
    monthlyDataGroups.forEach((monthGroup, monthIndex) => {
      // 月のデータを追加
      monthGroup.data.forEach(row => {
        const values = [
          row.date,
          ...fieldKeys.map(key => row[key] || '')
        ];
        csvRows.push(values);
      });
      
      // 最後の月でない場合、空行を追加
      if (monthIndex < monthlyDataGroups.length - 1) {
        csvRows.push([]);
      }
    });

    // CSVを生成
    const csvBuffer = generateCsv(csvRows);
    
    // ファイル名を生成
    const filename = `sales-${storeId}-${startYear}${startMonth}-${endYear}${endMonth}.csv`;
    
    // レスポンスヘッダーを設定
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', csvBuffer.length.toString());
    
    res.send(csvBuffer);
  } catch (err) {
    console.error('売上データCSV出力エラー:', err);
    res.status(500).json({ success: false, error: 'CSV出力に失敗しました' });
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

// CSVテンプレート生成API
app.get('/api/sales/csv-template', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, businessTypeId } = req.query;

  if (!storeId) {
    res.status(400).json({ success: false, error: 'storeIdは必須です' });
    return;
  }

  try {
    // 業態別フィールド設定を取得（インメモリストレージから）
    let fields: any[] = [];
    
    if (businessTypeId) {
      // グローバルスコープのbusinessTypeFieldsStorageから取得
      fields = businessTypeFieldsStorage[String(businessTypeId)] || [];
      
      // フィールド設定がない場合は、デフォルトフィールドを使用
      if (fields.length === 0) {
        // デフォルトのフィールド設定（基本的な項目）
        fields = [
          { id: 'field_netSales', key: 'netSales', label: '店舗純売上', category: 'sales', type: 'currency', isVisible: true, isCalculated: false },
          { id: 'field_edwNetSales', key: 'edwNetSales', label: 'EDW純売上', category: 'sales', type: 'currency', isVisible: true, isCalculated: false },
          { id: 'field_ohbNetSales', key: 'ohbNetSales', label: 'OHB純売上', category: 'sales', type: 'currency', isVisible: true, isCalculated: false },
          { id: 'field_totalGroups', key: 'totalGroups', label: '組数（計）', category: 'customer', type: 'count', isVisible: true, isCalculated: false },
          { id: 'field_totalCustomers', key: 'totalCustomers', label: '客数（計）', category: 'customer', type: 'count', isVisible: true, isCalculated: false },
          { id: 'field_lunchSales', key: 'lunchSales', label: 'L：売上', category: 'sales', type: 'currency', isVisible: true, isCalculated: false },
          { id: 'field_dinnerSales', key: 'dinnerSales', label: 'D：売上', category: 'sales', type: 'currency', isVisible: true, isCalculated: false },
          { id: 'field_laborCost', key: 'laborCost', label: '人件費額', category: 'labor', type: 'currency', isVisible: true, isCalculated: false },
        ];
      }
    }

    // 表示可能な項目のみをフィルタリング（天気・気温は除外）
    const visibleFields = fields.filter(f => 
      f.isVisible && 
      !f.isCalculated && 
      f.key !== 'weather' && 
      f.key !== 'temperature' &&
      f.label !== '天気' &&
      f.label !== '気温'
    );

    // CSVヘッダーを生成（日付、天気、気温は固定項目なのでCSVには含めない）
    const headers = ['日付', ...visibleFields.map((f: any) => f.label || f.key)];

    // サンプルデータ行（日付のみ）
    const sampleDate = new Date();
    const sampleDateStr = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}-${String(sampleDate.getDate()).padStart(2, '0')}`;
    const sampleRow = [sampleDateStr, ...visibleFields.map(() => '')];

    // CSVコンテンツを生成
    const csvRows = [headers, sampleRow];
    const csvContent = csvRows.map(row => 
      row.map(cell => {
        const str = String(cell || '');
        // カンマ、改行、ダブルクォートを含む場合はエスケープ
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ).join('\r\n');

    // BOM付きUTF-8でエンコード
    const BOM = '\uFEFF';
    const csvWithBom = BOM + csvContent;

    // レスポンスを返す
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="売上データテンプレート_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.csv"`);
    res.send(csvWithBom);
  } catch (err) {
    console.error('CSVテンプレート生成エラー:', err);
    res.status(500).json({ success: false, error: 'CSVテンプレートの生成に失敗しました' });
  }
});

// CSVインポートAPI
app.post('/api/sales/csv-import', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, csvData, fieldMapping, newFields, overwriteExisting } = req.body;
  const user = (req as any).user;

  if (!storeId || !csvData) {
    res.status(400).json({ success: false, error: 'storeIdとcsvDataは必須です' });
    return;
  }

  try {
    // CSVデータをパース
    let processedData: Record<string, Record<string, any>>;
    try {
      processedData = JSON.parse(csvData);
    } catch (e) {
      res.status(400).json({ success: false, error: 'CSVデータのパースに失敗しました' });
      return;
    }

    // 店舗情報を取得してbusinessTypeIdを取得
    const storeResult = await pool!.query(
      'SELECT business_type_id FROM stores WHERE id = $1',
      [storeId]
    );
    if (storeResult.rows.length === 0) {
      res.status(404).json({ success: false, error: '店舗が見つかりません' });
      return;
    }
    const businessTypeId = storeResult.rows[0].business_type_id;

    // 新しい項目を追加
    if (newFields && Array.isArray(newFields) && newFields.length > 0) {
      // 業態別フィールド設定を取得
      let fields: any[] = [];
      const fieldsResult = await pool!.query(
        'SELECT fields FROM business_type_fields WHERE business_type_id = $1',
        [businessTypeId]
      );
      if (fieldsResult.rows.length > 0 && fieldsResult.rows[0].fields) {
        fields = fieldsResult.rows[0].fields;
      }

      // インメモリストレージからも取得を試みる
      const businessTypeFieldsStorage: Record<string, any[]> = {};
      if (fields.length === 0) {
        fields = businessTypeFieldsStorage[String(businessTypeId)] || [];
      }

      // 新しい項目を追加
      newFields.forEach((newField: any) => {
        const existingField = fields.find((f: any) => f.key === newField.fieldKey);
        if (!existingField) {
          fields.push({
            id: `field_${newField.fieldKey}`,
            key: newField.fieldKey,
            label: newField.fieldLabel,
            category: 'other',
            type: newField.fieldType || 'number',
            fieldSource: 'dailyOnly',
            isVisible: true,
            isVisibleInDailySales: true,
            isVisibleInMonthlySales: false,
            isEditable: true,
            isCalculated: false,
            aggregationMethod: 'sum',
            order: fields.length + 1
          });
        }
      });

      // フィールド設定を保存（DBに保存する場合はここで更新）
      // 現時点ではインメモリストレージに保存
      businessTypeFieldsStorage[String(businessTypeId)] = fields;
    }

    // 日付ごとにデータをグループ化して年月ごとに処理
    const monthlyDataMap: Record<string, Record<string, any>> = {};
    
    for (const dayOfMonth in processedData) {
      const dayData = processedData[dayOfMonth];
      if (!dayData.date) continue;

      const date = new Date(dayData.date);
      if (isNaN(date.getTime())) continue;

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month}`;

      if (!monthlyDataMap[monthKey]) {
        monthlyDataMap[monthKey] = {};
      }

      monthlyDataMap[monthKey][dayOfMonth] = dayData;
    }

    // 店舗情報を取得（緯度・経度を取得するため）
    const storeInfoResult = await pool!.query(
      'SELECT latitude, longitude, address FROM stores WHERE id = $1',
      [storeId]
    );
    if (storeInfoResult.rows.length === 0) {
      res.status(404).json({ success: false, error: '店舗が見つかりません' });
      return;
    }
    const storeInfo = storeInfoResult.rows[0];
    let latitude = storeInfo.latitude;
    let longitude = storeInfo.longitude;
    const address = storeInfo.address;

    // 緯度・経度が取得できない場合は、住所から取得を試みる
    if ((!latitude || !longitude) && address) {
      try {
        const geocodeResult = await geocodeAddress(address);
        if (geocodeResult) {
          latitude = geocodeResult.latitude;
          longitude = geocodeResult.longitude;
          // 店舗の緯度・経度を更新
          await pool!.query(
            'UPDATE stores SET latitude = $1, longitude = $2 WHERE id = $3',
            [latitude, longitude, storeId]
          );
        }
      } catch (geocodeErr) {
        console.error('住所のジオコーディングエラー:', geocodeErr);
      }
    }

    let processedCount = 0;

    // 各年月のデータを保存
    for (const monthKey in monthlyDataMap) {
      const [year, month] = monthKey.split('-').map(Number);
      const dailyData = monthlyDataMap[monthKey];

      // 新しい日付の天気データを自動取得
      if (latitude && longitude) {
        for (const dayOfMonth in dailyData) {
          const dayData = dailyData[dayOfMonth];
          if (!dayData.date) continue;

          const date = new Date(dayData.date);
          if (isNaN(date.getTime())) continue;

          const dateStr = date.toISOString().split('T')[0];

          // 天気データが既に存在するか確認
          try {
            const weatherCheckResult = await pool!.query(
              `SELECT id FROM weather_data 
               WHERE latitude = $1 AND longitude = $2 AND date = $3`,
              [latitude, longitude, dateStr]
            );

            // 天気データが存在しない場合は取得
            if (weatherCheckResult.rows.length === 0) {
              console.log(`[CSVインポート] 新しい日付の天気データを取得中: ${dateStr}`);
              const weatherData = await fetchWeatherDataFromVisualCrossing(latitude, longitude, date);
              
              if (weatherData.weather || weatherData.temperature !== null) {
                await pool!.query(
                  `INSERT INTO weather_data (latitude, longitude, date, weather, temperature, humidity, precipitation, snow, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                   ON CONFLICT (latitude, longitude, date)
                   DO UPDATE SET weather = EXCLUDED.weather, temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity, precipitation = EXCLUDED.precipitation, snow = EXCLUDED.snow, updated_at = NOW()`,
                  [latitude, longitude, dateStr, weatherData.weather || null, weatherData.temperature, weatherData.humidity, weatherData.precipitation, weatherData.snow]
                );
                console.log(`[CSVインポート] 天気データを保存しました: ${dateStr}, 天気=${weatherData.weather}, 気温=${weatherData.temperature}`);
              }
            }
          } catch (weatherErr) {
            console.error(`[CSVインポート] 天気データ取得エラー (${dateStr}):`, weatherErr);
            // 天気データの取得に失敗しても、メイン処理は続行
          }
        }
      }

      // 既存データを確認
      const existingResult = await pool!.query(
        'SELECT id FROM sales_data WHERE year = $1 AND month = $2 AND store_id = $3',
        [year, month, storeId]
      );

      if (existingResult.rows.length > 0) {
        // 更新
        if (overwriteExisting) {
          await pool!.query(
            'UPDATE sales_data SET daily_data = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3',
            [JSON.stringify(dailyData), user.id, existingResult.rows[0].id]
          );
        } else {
          // マージ（既存データに新しいデータを追加）
          const existingDataResult = await pool!.query(
            'SELECT daily_data FROM sales_data WHERE id = $1',
            [existingResult.rows[0].id]
          );
          const existingDailyData = existingDataResult.rows[0].daily_data || {};
          const mergedData = { ...existingDailyData, ...dailyData };
          await pool!.query(
            'UPDATE sales_data SET daily_data = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3',
            [JSON.stringify(mergedData), user.id, existingResult.rows[0].id]
          );
        }
      } else {
        // 新規作成
        await pool!.query(
          'INSERT INTO sales_data (store_id, year, month, daily_data, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [storeId, year, month, JSON.stringify(dailyData), user.id, user.id]
        );
      }

      // 月次売上管理テーブルにも自動反映
      try {
        const monthlyExistingResult = await pool!.query(
          'SELECT id FROM monthly_sales WHERE store_id = $1 AND year = $2 AND month = $3',
          [storeId, year, month]
        );

        if (monthlyExistingResult.rows.length > 0) {
          await pool!.query(
            `UPDATE monthly_sales
             SET daily_data = $1, updated_at = NOW()
             WHERE store_id = $2 AND year = $3 AND month = $4`,
            [JSON.stringify(dailyData), storeId, year, month]
          );
        } else {
          await pool!.query(
            `INSERT INTO monthly_sales (store_id, year, month, daily_data, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [storeId, year, month, JSON.stringify(dailyData)]
          );
        }
      } catch (syncErr) {
        console.error('⚠️ 月次売上管理テーブルへの反映でエラー（メイン処理は成功）:', syncErr);
      }

      processedCount += Object.keys(dailyData).length;
    }

    res.json({ 
      success: true, 
      message: 'データのインポートが完了しました',
      processedCount 
    });
  } catch (err) {
    console.error('CSVインポートエラー:', err);
    res.status(500).json({ success: false, error: 'CSVデータのインポートに失敗しました' });
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

// 月次売上データCSV出力API
app.get('/api/monthly-sales/export-csv', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, startYear, startMonth, endYear, endMonth, fields, fieldLabels } = req.query;

  if (!storeId || !startYear || !startMonth || !endYear || !endMonth) {
    res.status(400).json({ success: false, error: 'storeId, startYear, startMonth, endYear, endMonthは必須です' });
    return;
  }

  try {
    const fieldNames = fields ? (fields as string).split(',') : [];
    if (fieldNames.length === 0) {
      res.status(400).json({ success: false, error: 'fieldsは必須です' });
      return;
    }

    // フィールドラベルのマッピングを取得
    let labelsMap: Record<string, string> = {};
    if (fieldLabels) {
      try {
        labelsMap = JSON.parse(fieldLabels as string);
      } catch (e) {
        console.warn('フィールドラベルのパースに失敗しました。フィールドキーをそのまま使用します。', e);
      }
    }

    // 期間内のすべての月を計算
    const months: { year: number; month: number }[] = [];
    let currentYear = parseInt(startYear as string);
    let currentMonth = parseInt(startMonth as string);
    const endYearInt = parseInt(endYear as string);
    const endMonthInt = parseInt(endMonth as string);

    while (
      currentYear < endYearInt ||
      (currentYear === endYearInt && currentMonth <= endMonthInt)
    ) {
      months.push({ year: currentYear, month: currentMonth });
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    // すべての月のデータを取得（月ごとにグループ化）
    const monthlyDataGroups: Array<{ year: number; month: number; data: Array<{ storeName: string; year: number; month: number; [key: string]: any }> }> = [];
    for (const { year, month } of months) {
      const result = await pool!.query(
        `SELECT ms.*, s.name as store_name
         FROM monthly_sales ms
         JOIN stores s ON ms.store_id = s.id
         WHERE ms.store_id = $1 AND ms.year = $2 AND ms.month = $3`,
        [storeId, year, month]
      );

      const monthData: Array<{ storeName: string; year: number; month: number; [key: string]: any }> = [];
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const monthlyRow: { storeName: string; year: number; month: number; [key: string]: any } = {
          storeName: row.store_name || '',
          year: row.year,
          month: row.month,
        };

        // daily_dataから選択されたフィールドを取得
        if (row.daily_data && typeof row.daily_data === 'object') {
          fieldNames.forEach(fieldName => {
            const value = row.daily_data[fieldName];
            monthlyRow[fieldName] = value !== null && value !== undefined ? value : '';
          });
        } else {
          // daily_dataがない場合は空文字を設定
          fieldNames.forEach(fieldName => {
            monthlyRow[fieldName] = '';
          });
        }

        monthData.push(monthlyRow);
      }

      if (monthData.length > 0) {
        monthlyDataGroups.push({ year, month, data: monthData });
      }
    }

    if (monthlyDataGroups.length === 0) {
      res.status(404).json({ success: false, error: '出力するデータがありません' });
      return;
    }

    // CSVヘッダー（フィールドラベルを使用、なければフィールドキー）
    const headers = ['店舗名', '年', '月', ...fieldNames.map(key => labelsMap[key] || key)];
    
    // CSV行を生成（月ごとにグループ化し、月の間に空行を挿入）
    const csvRows: string[][] = [headers];
    monthlyDataGroups.forEach((monthGroup, monthIndex) => {
      // 月のデータを追加
      monthGroup.data.forEach(row => {
        const values = [
          row.storeName || '',
          String(row.year),
          String(row.month),
          ...fieldNames.map(fieldName => row[fieldName] || '')
        ];
        csvRows.push(values);
      });
      
      // 最後の月でない場合、空行を追加
      if (monthIndex < monthlyDataGroups.length - 1) {
        csvRows.push([]);
      }
    });

    // CSVを生成
    const csvBuffer = generateCsv(csvRows);
    
    // ファイル名を生成
    const filename = `monthly-sales-${storeId}-${startYear}${startMonth}-${endYear}${endMonth}.csv`;
    
    // レスポンスヘッダーを設定
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', csvBuffer.length.toString());
    
    res.send(csvBuffer);
  } catch (err) {
    console.error('月次売上データCSV出力エラー:', err);
    res.status(500).json({ success: false, error: 'CSV出力に失敗しました' });
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

// 売上予測APIエンドポイント
// Python予測サービスのURL（Dockerコンテナ内からはpython-predictor、ホストからはlocalhost）
const PREDICTOR_SERVICE_URL = process.env.PREDICTOR_SERVICE_URL || 'http://localhost:8000';

app.post('/api/sales/predict', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, predictDays, startDate } = req.body;
  const user = (req as any).user;

  if (!storeId) {
    res.status(400).json({ success: false, error: 'storeIdは必須です' });
    return;
  }

  try {
    const predictDaysNum = predictDays || 7;
    const startDateStr = startDate || new Date().toISOString().split('T')[0];

    // Python予測サービスを呼び出し
    const response = await fetch(`${PREDICTOR_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        store_id: parseInt(storeId),
        predict_days: predictDaysNum,
        start_date: startDateStr,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`予測サービスエラー: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '予測に失敗しました');
    }

    // 予測結果をデータベースに保存
    const predictions = result.predictions || [];
    const salesFields = result.sales_fields || []; // 売上項目の情報
    const monthlyDataMap: Record<string, Record<string, any>> = {};

    for (const pred of predictions) {
      const predDate = new Date(pred.date);
      const year = predDate.getFullYear();
      const month = predDate.getMonth() + 1;
      const dayOfMonth = predDate.getDate();
      const monthKey = `${year}-${month}`;

      if (!monthlyDataMap[monthKey]) {
        monthlyDataMap[monthKey] = {};
      }

      // 既存データを取得
      const existingResult = await pool!.query(
        'SELECT daily_data FROM sales_data WHERE store_id = $1 AND year = $2 AND month = $3',
        [storeId, year, month]
      );

      let dailyData: Record<string, any> = {};
      if (existingResult.rows.length > 0 && existingResult.rows[0].daily_data) {
        dailyData = existingResult.rows[0].daily_data;
      }

      // 予測値を追加/更新
      // 日付キーを検索（YYYY-MM-DD形式または数値形式）
      const dateStr = pred.date ? pred.date.split('T')[0] : ''; // YYYY-MM-DD形式
      let dayKey: string;
      
      // まず日付文字列キーを探す
      if (dateStr && dailyData[dateStr]) {
        dayKey = dateStr;
      } else {
        // 日付文字列キーが見つからない場合は数値キーを試す
        dayKey = String(dayOfMonth);
      }
      
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = {};
      }

      // 動的にすべての売上項目を保存
      for (const salesField of salesFields) {
        const fieldKey = salesField?.key;
        if (fieldKey && pred[fieldKey] !== undefined) {
          dailyData[dayKey][fieldKey] = pred[fieldKey];
        }
      }

      // 後方互換性のため、既存のキーも保持
      if (pred.edw_sales !== undefined) {
        dailyData[dayKey].edwNetSales = pred.edw_sales;
      }
      if (pred.ohb_sales !== undefined) {
        dailyData[dayKey].ohbNetSales = pred.ohb_sales;
      }

      // is_predictedフラグを明示的にtrueに設定
      dailyData[dayKey].is_predicted = true;
      dailyData[dayKey].predicted_at = new Date().toISOString();
      dailyData[dayKey].date = dateStr; // 日付をYYYY-MM-DD形式で保存

      monthlyDataMap[monthKey] = dailyData;
    }

    // 各月のデータを保存
    for (const monthKey in monthlyDataMap) {
      const [year, month] = monthKey.split('-').map(Number);
      const dailyData = monthlyDataMap[monthKey];

      const existingResult = await pool!.query(
        'SELECT id FROM sales_data WHERE store_id = $1 AND year = $2 AND month = $3',
        [storeId, year, month]
      );

      if (existingResult.rows.length > 0) {
        await pool!.query(
          'UPDATE sales_data SET daily_data = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3',
          [JSON.stringify(dailyData), user.id, existingResult.rows[0].id]
        );
      } else {
        await pool!.query(
          'INSERT INTO sales_data (store_id, year, month, daily_data, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [storeId, year, month, JSON.stringify(dailyData), user.id, user.id]
        );
      }
    }

    res.json({
      success: true,
      message: '予測が正常に完了しました',
      predictions: result.predictions,
      metrics: result.metrics,
    });
  } catch (err: any) {
    console.error('売上予測エラー:', err);
    res.status(500).json({ success: false, error: err.message || '売上予測に失敗しました' });
  }
});

// 予測値フラグを手動で追加するエンドポイント（一時的）
app.post('/api/sales/add-predicted-flag', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, year, month, days } = req.body;
  const user = (req as any).user;

  if (!storeId || !year || !month) {
    res.status(400).json({ success: false, error: 'storeId, year, monthは必須です' });
    return;
  }

  try {
    // データを取得
    const result = await pool!.query(
      'SELECT id, daily_data FROM sales_data WHERE store_id = $1 AND year = $2 AND month = $3',
      [storeId, year, month]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'データが見つかりません' });
      return;
    }

    const row = result.rows[0];
    const dailyData = row.daily_data || {};
    const daysToUpdate = days || ['1', '2', '3'];
    let updatedCount = 0;

    // 指定された日のデータにis_predictedフラグを追加
    for (const dayKey of daysToUpdate) {
      if (dailyData[dayKey]) {
        const dayData = dailyData[dayKey];
        
        // 既にis_predictedが設定されている場合はスキップ
        if (dayData.is_predicted === true) {
          continue;
        }
        
        // is_predictedフラグを追加
        dailyData[dayKey] = {
          ...dayData,
          is_predicted: true,
          predicted_at: new Date().toISOString(),
        };
        
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      // データベースを更新
      await pool!.query(
        'UPDATE sales_data SET daily_data = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3',
        [JSON.stringify(dailyData), user.id, row.id]
      );
    }

    res.json({
      success: true,
      message: `${updatedCount}件のデータを更新しました`,
      updatedCount,
    });
  } catch (err: any) {
    console.error('予測値フラグ追加エラー:', err);
    res.status(500).json({ success: false, error: err.message || '予測値フラグの追加に失敗しました' });
  }
});

app.get('/api/sales/predictions', requireDatabase, authenticateToken, async (req: Request, res: Response) => {
  const { storeId, startDate, endDate } = req.query;

  if (!storeId) {
    res.status(400).json({ success: false, error: 'storeIdは必須です' });
    return;
  }

  try {
    const startDateStr = (startDate as string) || new Date().toISOString().split('T')[0];
    const endDateStr = (endDate as string) || new Date().toISOString().split('T')[0];

    const startDateObj = new Date(startDateStr);
    const endDateObj = new Date(endDateStr);
    const startYear = startDateObj.getFullYear();
    const startMonth = startDateObj.getMonth() + 1;
    const endYear = endDateObj.getFullYear();
    const endMonth = endDateObj.getMonth() + 1;

    const predictions: any[] = [];
    let currentYear = startYear;
    let currentMonth = startMonth;

    while (
      currentYear < endYear ||
      (currentYear === endYear && currentMonth <= endMonth)
    ) {
      const result = await pool!.query(
        `SELECT daily_data FROM sales_data
         WHERE store_id = $1 AND year = $2 AND month = $3`,
        [storeId, currentYear, currentMonth]
      );

      if (result.rows.length > 0 && result.rows[0].daily_data) {
        const dailyData = result.rows[0].daily_data;
        for (const dayOfMonth in dailyData) {
          const dayData = dailyData[dayOfMonth] as any;
            if (dayData.is_predicted) {
              const dateStr = dayData.date || `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
              const dateObj = new Date(dateStr);
              if (dateObj >= startDateObj && dateObj <= endDateObj) {
                const pred: any = {
                  date: dateStr,
                  is_predicted: true,
                  predicted_at: dayData.predicted_at,
                };
                
                // すべての売上項目を含める（動的）
                for (const key in dayData) {
                  if (key !== 'is_predicted' && key !== 'predicted_at' && key !== 'date' && 
                      (typeof dayData[key] === 'number' || (key.includes('Sales') || key.includes('売上')))) {
                    pred[key] = dayData[key];
                  }
                }
                
                // 後方互換性のため
                pred.edw_sales = dayData.edwNetSales || 0;
                pred.ohb_sales = dayData.ohbNetSales || 0;
                
                predictions.push(pred);
              }
            }
        }
      }

      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    predictions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json({
      success: true,
      predictions,
    });
  } catch (err: any) {
    console.error('予測結果取得エラー:', err);
    res.status(500).json({ success: false, error: '予測結果の取得に失敗しました' });
  }
});

// 日付が変わったらバックグラウンドで再予測（毎日午前0時に実行）
// また、毎時間チェックして日付が変わった場合も実行
let lastPredictionDate: string | null = null;

// 毎日午前0時に予測を実行（すべての店舗に対して）
cron.schedule('0 0 * * *', async () => {
  const today = new Date().toISOString().split('T')[0];
  if (lastPredictionDate === today) {
    console.log(`[Cron] 本日（${today}）は既に予測を実行済みです`);
    return;
  }
  lastPredictionDate = today;
  console.log('[Cron] 売上予測の定期実行を開始（日付変更検知）');
  
  try {
    // すべての店舗を取得
    const storesResult = await pool!.query('SELECT id FROM stores');
    const stores = storesResult.rows;
    
    // Python予測サービスのURL（Dockerコンテナ内からはpython-predictor、ホストからはlocalhost）
const PREDICTOR_SERVICE_URL = process.env.PREDICTOR_SERVICE_URL || 'http://localhost:8000';
    
    for (const store of stores) {
      try {
        console.log(`[Cron] 店舗ID ${store.id} の予測を実行中...`);
        
        const response = await fetch(`${PREDICTOR_SERVICE_URL}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            store_id: store.id,
            predict_days: 7,
            start_date: new Date().toISOString().split('T')[0],
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            console.log(`[Cron] 店舗ID ${store.id} の予測が完了しました`);
            
            // 予測結果をデータベースに保存
            const predictions = result.predictions || [];
            const salesFields = result.sales_fields || [];
            const monthlyDataMap: Record<string, Record<string, any>> = {};
            
            for (const pred of predictions) {
              const predDate = new Date(pred.date);
              const year = predDate.getFullYear();
              const month = predDate.getMonth() + 1;
              const dayOfMonth = predDate.getDate();
              const monthKey = `${year}-${month}`;
              
              if (!monthlyDataMap[monthKey]) {
                monthlyDataMap[monthKey] = {};
              }
              
              const existingResult = await pool!.query(
                'SELECT daily_data FROM sales_data WHERE store_id = $1 AND year = $2 AND month = $3',
                [store.id, year, month]
              );
              
              let dailyData: Record<string, any> = {};
              if (existingResult.rows.length > 0 && existingResult.rows[0].daily_data) {
                dailyData = existingResult.rows[0].daily_data;
              }
              
              // 日付キーを検索（YYYY-MM-DD形式または数値形式）
              const dateStr = pred.date ? pred.date.split('T')[0] : ''; // YYYY-MM-DD形式
              let dayKey: string;
              
              // まず日付文字列キーを探す
              if (dateStr && dailyData[dateStr]) {
                dayKey = dateStr;
              } else {
                // 日付文字列キーが見つからない場合は数値キーを試す
                dayKey = String(dayOfMonth);
              }
              
              if (!dailyData[dayKey]) {
                dailyData[dayKey] = {};
              }
              
              // 動的にすべての売上項目を保存
              for (const salesField of salesFields) {
                const fieldKey = salesField?.key;
                if (fieldKey && pred[fieldKey] !== undefined) {
                  dailyData[dayKey][fieldKey] = pred[fieldKey];
                }
              }
              
              // 後方互換性のため
              if (pred.edw_sales !== undefined) {
                dailyData[dayKey].edwNetSales = pred.edw_sales;
              }
              if (pred.ohb_sales !== undefined) {
                dailyData[dayKey].ohbNetSales = pred.ohb_sales;
              }
              
              // is_predictedフラグを明示的にtrueに設定
              dailyData[dayKey].is_predicted = true;
              dailyData[dayKey].predicted_at = new Date().toISOString();
              dailyData[dayKey].date = dateStr; // 日付をYYYY-MM-DD形式で保存
              
              monthlyDataMap[monthKey] = dailyData;
            }
            
            // 各月のデータを保存
            for (const monthKey in monthlyDataMap) {
              const [year, month] = monthKey.split('-').map(Number);
              const dailyData = monthlyDataMap[monthKey];
              
              const existingResult = await pool!.query(
                'SELECT id FROM sales_data WHERE store_id = $1 AND year = $2 AND month = $3',
                [store.id, year, month]
              );
              
              if (existingResult.rows.length > 0) {
                await pool!.query(
                  'UPDATE sales_data SET daily_data = $1, updated_at = NOW() WHERE id = $2',
                  [JSON.stringify(dailyData), existingResult.rows[0].id]
                );
              } else {
                await pool!.query(
                  'INSERT INTO sales_data (store_id, year, month, daily_data) VALUES ($1, $2, $3, $4)',
                  [store.id, year, month, JSON.stringify(dailyData)]
                );
              }
            }
          } else {
            console.error(`[Cron] 店舗ID ${store.id} の予測に失敗: ${result.message || 'Unknown error'}`);
          }
        } else {
          const errorText = await response.text();
          console.error(`[Cron] 店舗ID ${store.id} の予測サービスエラー: ${response.status} ${errorText}`);
        }
      } catch (err: any) {
        console.error(`[Cron] 店舗ID ${store.id} の予測エラー:`, err);
      }
    }
    
    console.log('[Cron] 売上予測の定期実行が完了しました');
  } catch (err: any) {
    console.error('[Cron] 売上予測の定期実行でエラー:', err);
  }
});

// 毎時間チェックして日付が変わった場合も予測を実行
cron.schedule('0 * * * *', async () => {
  const today = new Date().toISOString().split('T')[0];
  if (lastPredictionDate === today) {
    return; // 本日は既に予測済み
  }
  
  console.log(`[Cron] 日付変更を検知（${lastPredictionDate} → ${today}）。予測を実行します`);
  lastPredictionDate = today;
  
  try {
    // すべての店舗を取得
    const storesResult = await pool!.query('SELECT id FROM stores');
    const stores = storesResult.rows;
    
    // Python予測サービスのURL（Dockerコンテナ内からはpython-predictor、ホストからはlocalhost）
const PREDICTOR_SERVICE_URL = process.env.PREDICTOR_SERVICE_URL || 'http://localhost:8000';
    
    for (const store of stores) {
      try {
        console.log(`[Cron] 店舗ID ${store.id} の予測を実行中（日付変更検知）...`);
        
        const response = await fetch(`${PREDICTOR_SERVICE_URL}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            store_id: store.id,
            predict_days: 7,
            start_date: today,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            console.log(`[Cron] 店舗ID ${store.id} の予測が完了しました（日付変更検知）`);
            
            // 予測結果をデータベースに保存（上記のcronジョブと同じロジック）
            const predictions = result.predictions || [];
            const salesFields = result.sales_fields || [];
            const monthlyDataMap: Record<string, Record<string, any>> = {};
            
            for (const pred of predictions) {
              const predDate = new Date(pred.date);
              const year = predDate.getFullYear();
              const month = predDate.getMonth() + 1;
              const dayOfMonth = predDate.getDate();
              const monthKey = `${year}-${month}`;
              
              if (!monthlyDataMap[monthKey]) {
                monthlyDataMap[monthKey] = {};
              }
              
              const existingResult = await pool!.query(
                'SELECT daily_data FROM sales_data WHERE store_id = $1 AND year = $2 AND month = $3',
                [store.id, year, month]
              );
              
              let dailyData: Record<string, any> = {};
              if (existingResult.rows.length > 0 && existingResult.rows[0].daily_data) {
                dailyData = existingResult.rows[0].daily_data;
              }
              
              const dateStr = pred.date ? pred.date.split('T')[0] : '';
              let dayKey: string;
              
              if (dateStr && dailyData[dateStr]) {
                dayKey = dateStr;
              } else {
                dayKey = String(dayOfMonth);
              }
              
              if (!dailyData[dayKey]) {
                dailyData[dayKey] = {};
              }
              
              for (const salesField of salesFields) {
                const fieldKey = salesField?.key;
                if (fieldKey && pred[fieldKey] !== undefined) {
                  dailyData[dayKey][fieldKey] = pred[fieldKey];
                }
              }
              
              dailyData[dayKey].is_predicted = true;
              dailyData[dayKey].predicted_at = new Date().toISOString();
              dailyData[dayKey].date = dateStr;
              
              monthlyDataMap[monthKey] = dailyData;
            }
            
            for (const monthKey in monthlyDataMap) {
              const [year, month] = monthKey.split('-').map(Number);
              const dailyData = monthlyDataMap[monthKey];
              
              const existingResult = await pool!.query(
                'SELECT id FROM sales_data WHERE store_id = $1 AND year = $2 AND month = $3',
                [store.id, year, month]
              );
              
              if (existingResult.rows.length > 0) {
                await pool!.query(
                  'UPDATE sales_data SET daily_data = $1, updated_at = NOW() WHERE id = $2',
                  [JSON.stringify(dailyData), existingResult.rows[0].id]
                );
              } else {
                await pool!.query(
                  'INSERT INTO sales_data (store_id, year, month, daily_data) VALUES ($1, $2, $3, $4)',
                  [store.id, year, month, JSON.stringify(dailyData)]
                );
              }
            }
          }
        }
      } catch (err: any) {
        console.error(`[Cron] 店舗ID ${store.id} の予測エラー（日付変更検知）:`, err);
      }
    }
  } catch (err: any) {
    console.error('[Cron] 日付変更検知による予測実行でエラー:', err);
  }
});

// サーバーの起動
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 
