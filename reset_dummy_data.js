import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function reset() {
  console.log("Resetting dummy data...");
  
  // 1. ダミーのインポート履歴を削除 (source_account が 'ダミーテスト' または 'ダミー' のもの)
  const { error: inqErr1 } = await supabase.from('inquiries').delete().ilike('source_account', '%ダミー%');
  const { error: inqErr2 } = await supabase.from('inquiries').delete().ilike('source_account', '%日本認知症協会公式%'); // さっきのテストの可能性
  console.log("Delete inquiries error:", inqErr1 || inqErr2);

  // 2. 自動作成された顧客（ユキエ、スズキジュン）を削除
  const { error: cusErr1 } = await supabase.from('customers').delete().in('name', ['ユキエ', 'スズキジュン', 'システム']);
  console.log("Delete auto-created customers error:", cusErr1);

  // 3. 白川様のLステップURLをクリア
  const { error: cusErr2 } = await supabase.from('customers').update({ lstep_url: null }).eq('name', '白川 幸枝');
  console.log("Reset Shirakawa-sama URL error:", cusErr2);

  console.log("Done.");
}
reset()
