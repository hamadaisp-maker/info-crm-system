import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const nameQuery = searchParams.get('name')
        const sourceId = searchParams.get('sourceId')

        if (!nameQuery) {
            return NextResponse.json({ suggestions: [] })
        }

        // 検索用キーワードの正規化（全角半角スペース除去）
        const normalizedName = nameQuery.replace(/[\s\u3000]+/g, '')

        // 簡単な平仮名・カタカナ変換（簡易的な揺れ吸収用）
        const toKatakana = (str: string) => str.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60))
        const toHiragana = (str: string) => str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60))

        const katakanaName = toKatakana(normalizedName)
        const hiraganaName = toHiragana(normalizedName)

        const supabase = createClient()

        // 類似顧客の検索ロジック
        // 本名やフリガナに「サジェスト元の名前」が部分一致するものを抽出
        let query = supabase
            .from('customers')
            .select('id, name, kana, email, phone, customer_type, company')

        if (sourceId) {
            query = query.neq('id', sourceId)
        }

        // OR条件で、名前またはフリガナ（ひらがな、カタカナ両方対応）に部分一致検索をかける
        const { data: suggestions, error } = await query
            .or(`name.ilike.%${normalizedName}%,kana.ilike.%${katakanaName}%,kana.ilike.%${hiraganaName}%,name.ilike.%${katakanaName}%,name.ilike.%${hiraganaName}%`)
            .limit(5)

        if (error) {
            console.error('Error fetching suggestions:', error)
            return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
        }

        return NextResponse.json({ suggestions: suggestions || [] })
    } catch (error) {
        console.error('API Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
