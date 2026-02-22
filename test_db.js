import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// dotenvの設定を読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('customers').select('name, lstep_url').eq('name', '白川 幸枝')
  console.log("DB Data:", data, "Error:", error)
}
test()
