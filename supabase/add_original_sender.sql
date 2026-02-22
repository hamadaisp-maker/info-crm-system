-- inquiriesテーブルに、LINE等からインポートされた際の元々の送信者名を保存するカラムを追加します。
ALTER TABLE public.inquiries
ADD COLUMN original_sender TEXT;

COMMENT ON COLUMN public.inquiries.original_sender IS 'インポート時の元々の送信者名（LINEネーム等）';
