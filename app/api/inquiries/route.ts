import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, phone, email, company, channel, direction, content } = body

        // 簡易バリデーション
        if (!name || !content) {
            return NextResponse.json(
                { error: 'Name and content are required' },
                { status: 400 }
            )
        }

        const supabase = createClient()

        // 1. 顧客の検索または作成（電話番号かメールアドレス、あるいは名前で簡易判定）
        let customerId = null

        // まずは名前と電話番号（またはEmail）で既存顧客を探す
        let query = supabase.from('customers').select('id').eq('name', name).limit(1)
        const { data: existingCustomers, error: searchError } = await query

        if (searchError) {
            console.error('Customer search error:', searchError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        if (existingCustomers && existingCustomers.length > 0) {
            customerId = existingCustomers[0].id
        } else {
            // 存在しなければ新規作成
            const { data: newCustomer, error: createError } = await supabase
                .from('customers')
                .insert([{
                    name,
                    phone: phone || null,
                    email: email || null,
                    customer_type: company === '日本認知症協会' ? '協会会員' :
                        company === 'JapanRecord' ? 'JapanRecord顧客' : '未分類'
                }])
                .select()
                .single()

            if (createError) {
                console.error('Customer create error:', createError)
                return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
            }
            customerId = newCustomer.id
        }

        // 2. 問い合わせ（対応履歴）の作成
        const { error: inquiryError } = await supabase
            .from('inquiries')
            .insert([{
                customer_id: customerId,
                company,
                channel,
                direction,
                content,
                status: '対応中', // 初期ステータス
                received_at: new Date().toISOString()
            }])

        if (inquiryError) {
            console.error('Inquiry create error:', inquiryError)
            return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('API Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
