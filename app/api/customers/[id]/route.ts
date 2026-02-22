import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

        const body = await request.json()
        const { name, kana, phone, email, customer_type, notes, lstep_url } = body

        const supabase = createClient()
        const { error } = await supabase
            .from('customers')
            .update({
                name,
                kana,
                phone,
                email,
                customer_type,
                notes,
                lstep_url,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) {
            console.error('Customer update error:', error)
            return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('API Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
