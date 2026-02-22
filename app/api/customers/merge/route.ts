import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { sourceId, targetId } = body

        if (!sourceId || !targetId) {
            return NextResponse.json({ error: 'Source ID and Target ID are required' }, { status: 400 })
        }
        if (sourceId === targetId) {
            return NextResponse.json({ error: 'Cannot merge a customer into themselves' }, { status: 400 })
        }

        const supabase = createClient()

        // 1. ソース顧客とターゲット顧客の情報を取得
        const { data: sourceCustomer, error: sourceErr } = await supabase
            .from('customers')
            .select('*')
            .eq('id', sourceId)
            .single()

        const { data: targetCustomer, error: targetErr } = await supabase
            .from('customers')
            .select('*')
            .eq('id', targetId)
            .single()

        if (sourceErr || !sourceCustomer || targetErr || !targetCustomer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
        }

        // 2. 統合先（ターゲット）の顧客情報を更新するためのデータ準備
        const updatePayload: any = { updated_at: new Date().toISOString() }

        // メモの結合（ソースにメモがあって、まだターゲットにない場合など）
        if (sourceCustomer.notes) {
            if (targetCustomer.notes) {
                // 両方にメモがある場合は追記
                updatePayload.notes = `${targetCustomer.notes}\n\n[統合された顧客メモ (${sourceCustomer.name})]\n${sourceCustomer.notes}`
            } else {
                updatePayload.notes = sourceCustomer.notes
            }
        }

        // LステップURLの統合（ターゲットが持っていなくてソースが持っている場合）
        if (!targetCustomer.lstep_url && sourceCustomer.lstep_url) {
            updatePayload.lstep_url = sourceCustomer.lstep_url
        }

        // LINE IDの統合
        if (!targetCustomer.line_id && sourceCustomer.line_id) {
            updatePayload.line_id = sourceCustomer.line_id
        }

        // 対象会社の統合（例: 不明から具体的な会社へ、または両方へ対応させるなど。今回はシンプルにターゲット優先だが補填を行う）
        if (targetCustomer.company && sourceCustomer.company && targetCustomer.company !== sourceCustomer.company) {
            if (targetCustomer.company === '不明' || !targetCustomer.company) {
                updatePayload.company = sourceCustomer.company;
            }
        }

        // 3. トランザクション的な処理（Supabase Client直叩きなので順番に実行）

        // A. ターゲット顧客のメタデータを更新
        if (Object.keys(updatePayload).length > 1) { // updated_at 以外に更新要素があるか
            const { error: updateErr } = await supabase
                .from('customers')
                .update(updatePayload)
                .eq('id', targetId)

            if (updateErr) throw new Error('Failed to update target customer')
        }

        // B. ソース顧客に紐づく全ての対応履歴（inquiries）の所有者をターゲットへ付け替える
        const { error: inquiriesErr } = await supabase
            .from('inquiries')
            .update({ customer_id: targetId })
            .eq('customer_id', sourceId)

        if (inquiriesErr) throw new Error('Failed to reassign inquiries')

        // C. 古いソース顧客のデータを物理削除する
        const { error: deleteErr } = await supabase
            .from('customers')
            .delete()
            .eq('id', sourceId)

        if (deleteErr) throw new Error('Failed to delete source customer')

        return NextResponse.json({ success: true, message: 'Merge completed successfully' })

    } catch (error) {
        console.error('Merge API Error:', error)
        return NextResponse.json({ error: 'Internal server error during merge process' }, { status: 500 })
    }
}
