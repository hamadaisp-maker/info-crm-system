-- inquiriesテーブルに、LINEのどのアカウントからの流入かを記録するためのカラムを追加します。
-- （電話やメールなど別のチャネルの場合はNULLが入ることを許容します）
ALTER TABLE public.inquiries
ADD COLUMN source_account TEXT;

COMMENT ON COLUMN public.inquiries.source_account IS 'LINE公式アカウントの名前など、流入元の具体的なアカウント名';
