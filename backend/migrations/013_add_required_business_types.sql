-- 必須業態（温野菜、ピザーラ、EDW）の追加
BEGIN;

-- 温野菜、ピザーラ、EDWの業態を追加（存在しない場合のみ）
INSERT INTO business_types (name) VALUES 
  ('温野菜'),
  ('ピザーラ'),
  ('EDW')
ON CONFLICT (name) DO NOTHING;

-- 追加された業態の確認ログ出力用
DO $$
DECLARE
  onyanasai_count integer;
  pizzala_count integer;
  edw_count integer;
BEGIN
  SELECT COUNT(*) INTO onyanasai_count FROM business_types WHERE name = '温野菜';
  SELECT COUNT(*) INTO pizzala_count FROM business_types WHERE name = 'ピザーラ';
  SELECT COUNT(*) INTO edw_count FROM business_types WHERE name = 'EDW';
  
  RAISE NOTICE '温野菜業態: % 件', onyanasai_count;
  RAISE NOTICE 'ピザーラ業態: % 件', pizzala_count;
  RAISE NOTICE 'EDW業態: % 件', edw_count;
END $$;

COMMIT; 