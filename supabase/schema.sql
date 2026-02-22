-- ========================================================
-- [日本認知症協会 / JapanRecord 問い合わせ管理システム]
-- 初期Supabase DBスキーマ (PostgreSQL)
-- ========================================================

-- UUID拡張を有効化（Supabaseではデフォルトで有効な場合が多いですが念のため）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 顧客テーブル (Customers)
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    kana TEXT,
    email TEXT,
    phone TEXT,
    line_id TEXT,
    customer_type TEXT, -- '協会会員', 'JapanRecord顧客', '両方' などを想定
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 問い合わせ・対応履歴テーブル (Inquiries)
CREATE TABLE public.inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    company TEXT NOT NULL, -- '日本認知症協会', 'JapanRecord'
    channel TEXT NOT NULL, -- 'Email', '電話', 'LINE', 'その他'
    direction TEXT NOT NULL, -- 'IN' (受信/受電), 'OUT' (送信/架電)
    category TEXT, -- '問合せ内容' カテゴリ分類など
    status TEXT NOT NULL DEFAULT '未対応', -- '未対応', '対応中', '完了'
    subject TEXT, -- 件名・見出し
    content TEXT, -- 問い合わせ内容・対応内容の詳細
    answer TEXT, -- 回答内容
    notes TEXT, -- 架電・連絡事項、社内メモ
    assignee TEXT, -- 担当者（テキストまたはユーザーID）
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 受信日時/受電日時
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 自動更新用のトリガー関数: updated_at を更新
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_customers_modtime
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_inquiries_modtime
BEFORE UPDATE ON public.inquiries
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Row Level Security (RLS) を設定 (初期フェーズとして認証済みユーザーにフルアクセス権限を付与)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access for authenticated users to customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for authenticated users to inquiries" ON public.inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);
