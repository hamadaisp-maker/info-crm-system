import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase'

/**
 * 外部システム（GASやWebhook）から問い合わせ履歴を受信するための専用API
 * セキュリティとして簡単なBearer Token認証（APIキー）を実装しています
 */
export async function POST(request: Request) {
    try {
        // 1. APIキー認証（セキュリティチェック）
        const authHeader = request.headers.get('authorization')
        const expectedToken = process.env.WEBHOOK_SECRET_TOKEN

        // 環境変数が設定されていない、またはトークンが一致しない場合は401エラー
        if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. リクエストボディのパース
        const body = await request.json()
        const { name, phone, email, company, channel, direction, content, source_account, received_at } = body

        // 必須項目のチェック
        if (!name || !content || !channel) {
            return NextResponse.json(
                { error: 'name, channel, and content are required fields' },
                { status: 400 }
            )
        }

        const supabase = createClient()

        // 3. 既存顧客の検索または新規作成
        let customerId = null

        // ① まずは完全一致する名前で検索
        let query = supabase.from('customers').select('id, name').eq('name', name)
        const { data: existingCustomers, error: searchError } = await query

        if (searchError) {
            console.error('Customer search error:', searchError)
            return NextResponse.json({ error: 'Database search error' }, { status: 500 })
        }

        if (existingCustomers && existingCustomers.length > 0) {
            // 見つかれば最初のIDを再利用（※本来はメアド等での複合一意判定が望ましい）
            customerId = existingCustomers[0].id
        } else {
            // 見つからなければ新規顧客として登録
            const { data: newCustomer, error: createError } = await supabase
                .from('customers')
                .insert([{
                    name,
                    phone: phone || null,
                    email: email || null,
                    customer_type: company === '日本認知症協会' ? '協会会員' :
                        company === 'JapanRecord' ? 'JapanRecord顧客' : '未分類',
                    company: company || '不明'
                }])
                .select()
                .single()

            if (createError) {
                console.error('Customer create error:', createError)
                return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
            }
            customerId = newCustomer.id
        }

        // 4. 対応履歴（inquiries）の挿入
        const { error: inquiryError } = await supabase
            .from('inquiries')
            .insert([{
                customer_id: customerId,
                company: company || '不明',
                channel,
                direction: direction || 'IN', // 受信・送信
                content,
                status: '未対応', // 外部連携で入ったものは原則「未対応」として担当者の確認を促す
                source_account: source_account || null,
                received_at: received_at ? new Date(received_at).toISOString() : new Date().toISOString()
            }])

        if (inquiryError) {
            console.error('Inquiry create error:', inquiryError)
            return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 })
        }

        // 成功を返す
        return NextResponse.json({ success: true, message: 'Webhook processed successfully' })

    } catch (error) {
        console.error('Webhook API Error:', error)
        return NextResponse.json({ error: 'Internal server error processing webhook' }, { status: 500 })
    }
}
