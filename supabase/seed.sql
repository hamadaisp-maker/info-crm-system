-- 日本認知症協会・JapanRecord 統合問い合わせ管理システム
-- デモ用初期データ登録スクリプト

-- // 1. 顧客データ (Customers) の登録 //

WITH inserted_customers AS (
  INSERT INTO public.customers (name, kana, email, phone, customer_type, notes)
  VALUES
    ('白川 幸枝', 'シラカワ ユキエ', 'shirakawa.y@example.com', '090-1111-2222', '協会会員', 'DVD購入履歴あり'),
    ('岩目地 興子', 'イワメジ オキコ', 'iwameji.okiko@example.net', '080-3333-4444', '協会会員', 'セミナー頻繁に参加'),
    ('鈴木 潤', 'スズキ ジュン', 'suzuki.jun@example.jp', '03-5555-6666', 'JapanRecord顧客', 'リコードクラブ案内中'),
    ('田中 太郎', 'タナカ タロウ', 'tanaka.taro@example.com', '070-7777-8888', '両方', 'VIP顧客')
  RETURNING id, name
)

-- // 2. 問い合わせ履歴 (Inquiries) の登録 //
-- ※ 上記で登録した顧客IDを動的に参照して登録します。

INSERT INTO public.inquiries (customer_id, company, channel, direction, category, status, subject, content, answer, notes, assignee, received_at)
SELECT
  c.id,
  '日本認知症協会',
  '電話',
  'IN',
  'キャンセル・返品',
  '対応中',
  'DVDの返品について',
  'DVD代金2000円のみキャンセルを承ることは可能かという問い合わせ。商品はまだ未開封とのこと。',
  '規約上未開封であれば可能であることをお伝えし、返品手順の部署に引き継ぎ中。',
  '折り返し対応待ち',
  '佐藤',
  NOW() - INTERVAL '2 hours'
FROM inserted_customers c WHERE c.name = '白川 幸枝'

UNION ALL

SELECT
  c.id,
  '日本認知症協会',
  'Email',
  'IN',
  'セミナー申し込み',
  '完了',
  '和マインド食入門セミナー視聴',
  '申し込み受け付け完了メールに対しての返信です。ありがとうございます。楽しみにしています、という内容。',
  '（返信不要と判断しクローズ）',
  '',
  '自動処理',
  NOW() - INTERVAL '1 day'
FROM inserted_customers c WHERE c.name = '岩目地 興子'

UNION ALL

SELECT
  c.id,
  'JapanRecord',
  '電話',
  'OUT',
  '営業・案内',
  '完了',
  '特別プランのご案内件',
  'ジャパンリコードクラブの販売開始のご連絡をお電話にてお伝えしました。',
  'ご本人は現在別のプログラムを実施中とのことで、今回は見送り。来月以降に再度ご案内の予約あり。',
  '来月15日頃に再架電リストに入れること。',
  '高橋',
  NOW() - INTERVAL '3 days'
FROM inserted_customers c WHERE c.name = '鈴木 潤';
