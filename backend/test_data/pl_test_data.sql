-- 損益管理（P&L）のテストデータ
-- このファイルは開発・デバッグ用のサンプルデータを提供します

DO $$
DECLARE
    v_store_id INTEGER;
    v_user_id INTEGER;
    v_pl_statement_id UUID;
BEGIN
    -- 最初の店舗IDを取得
    SELECT id INTO v_store_id FROM stores ORDER BY created_at LIMIT 1;

    -- 最初のユーザーIDを取得
    SELECT id INTO v_user_id FROM employees WHERE role = 'super_admin' LIMIT 1;

    IF v_store_id IS NULL THEN
        RAISE NOTICE '店舗データが見つかりません。先に店舗を作成してください。';
        RETURN;
    END IF;

    -- 既存データがあれば削除
    DELETE FROM pl_items WHERE pl_statement_id IN (
        SELECT id FROM pl_statements WHERE store_id = v_store_id AND year = 2025 AND month = 1
    );
    DELETE FROM pl_statements WHERE store_id = v_store_id AND year = 2025 AND month = 1;

    -- 2025年1月の損益表ヘッダを作成
    INSERT INTO pl_statements (store_id, year, month, created_by)
    VALUES (v_store_id, 2025, 1, v_user_id)
    RETURNING id INTO v_pl_statement_id;

    -- 損益表の各科目を挿入
    -- 売上高
    INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order) VALUES
    (v_pl_statement_id, '売上高', 5000000, 4925000, false, false, false, 1),
    (v_pl_statement_id, '店舗売上', 3500000, 3420000, false, false, true, 2),
    (v_pl_statement_id, 'EDW売上', 1000000, 1055000, false, false, true, 3),
    (v_pl_statement_id, 'OHB売上', 500000, 450000, false, false, true, 4),
    (v_pl_statement_id, '売上合計', 5000000, 4925000, true, true, false, 5);

    -- 原価
    INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order) VALUES
    (v_pl_statement_id, '原価', 1500000, 1478000, false, false, false, 6),
    (v_pl_statement_id, '食材費', 1200000, 1180000, false, false, true, 7),
    (v_pl_statement_id, '飲料費', 200000, 198000, false, false, true, 8),
    (v_pl_statement_id, '消耗品費', 100000, 100000, false, false, true, 9),
    (v_pl_statement_id, '原価合計', 1500000, 1478000, true, true, false, 10);

    -- 粗利益
    INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order) VALUES
    (v_pl_statement_id, '粗利益', 3500000, 3447000, true, true, false, 11);

    -- 販管費
    INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order) VALUES
    (v_pl_statement_id, '販管費', 2800000, 2750000, false, false, false, 12),
    (v_pl_statement_id, '人件費', 1500000, 1480000, false, false, true, 13),
    (v_pl_statement_id, '社員給与', 800000, 800000, false, false, true, 14),
    (v_pl_statement_id, 'AS給与', 650000, 640000, false, false, true, 15),
    (v_pl_statement_id, '法定福利費', 50000, 40000, false, false, true, 16),
    (v_pl_statement_id, '水道光熱費', 350000, 345000, false, false, true, 17),
    (v_pl_statement_id, '電気代', 200000, 195000, false, false, true, 18),
    (v_pl_statement_id, 'ガス代', 100000, 100000, false, false, true, 19),
    (v_pl_statement_id, '水道代', 50000, 50000, false, false, true, 20),
    (v_pl_statement_id, '家賃', 500000, 500000, false, false, true, 21),
    (v_pl_statement_id, '広告宣伝費', 150000, 135000, false, false, true, 22),
    (v_pl_statement_id, '通信費', 30000, 28000, false, false, true, 23),
    (v_pl_statement_id, 'リース料', 100000, 100000, false, false, true, 24),
    (v_pl_statement_id, '修繕費', 50000, 42000, false, false, true, 25),
    (v_pl_statement_id, 'その他経費', 120000, 120000, false, false, true, 26),
    (v_pl_statement_id, '販管費合計', 2800000, 2750000, true, true, false, 27);

    -- 営業利益
    INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order) VALUES
    (v_pl_statement_id, '営業利益', 700000, 697000, true, true, false, 28);

    -- 営業外収益・費用
    INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order) VALUES
    (v_pl_statement_id, '営業外収益', 10000, 12000, false, false, false, 29),
    (v_pl_statement_id, '営業外費用', 50000, 48000, false, false, false, 30);

    -- 経常利益
    INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order) VALUES
    (v_pl_statement_id, '経常利益', 660000, 661000, true, true, false, 31);

    -- 償却前利益
    INSERT INTO pl_items (pl_statement_id, subject_name, estimate, actual, is_highlighted, is_subtotal, is_indented, sort_order) VALUES
    (v_pl_statement_id, '減価償却費', 80000, 80000, false, false, false, 32),
    (v_pl_statement_id, '償却前利益', 740000, 741000, true, true, false, 33);

    RAISE NOTICE 'P&Lテストデータを正常に挿入しました (店舗ID: %, 2025年1月)', v_store_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'エラーが発生しました: %', SQLERRM;
END $$;

-- 挿入されたデータの確認
SELECT
    ps.id as statement_id,
    s.name as store_name,
    ps.year,
    ps.month,
    COUNT(pi.id) as item_count
FROM pl_statements ps
JOIN stores s ON s.id = ps.store_id
LEFT JOIN pl_items pi ON pi.pl_statement_id = ps.id
WHERE ps.year = 2025 AND ps.month = 1
GROUP BY ps.id, s.name, ps.year, ps.month;

-- 損益項目の詳細確認
SELECT
    pi.subject_name,
    pi.estimate,
    pi.actual,
    pi.actual - pi.estimate as difference,
    CASE WHEN pi.is_subtotal THEN '小計' ELSE '' END as type,
    CASE WHEN pi.is_highlighted THEN '★' ELSE '' END as highlight
FROM pl_items pi
JOIN pl_statements ps ON ps.id = pi.pl_statement_id
WHERE ps.year = 2025 AND ps.month = 1
ORDER BY pi.sort_order;
