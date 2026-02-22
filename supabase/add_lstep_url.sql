-- customersテーブルに、Lステップの個別ユーザー詳細画面へのURLを保存するカラムを追加します。
ALTER TABLE public.customers
ADD COLUMN lstep_url TEXT;

COMMENT ON COLUMN public.customers.lstep_url IS 'Lステップの個別ユーザー管理画面URL (例: https://manager.linestep.net/line/detail/xxx)';
