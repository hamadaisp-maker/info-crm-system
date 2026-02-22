import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

        const body = await request.json()
        const { status, answer, notes } = body

        const supabase = createClient()
        const { error } = await supabase
            .from('inquiries')
            .update({
                status,
                answer,
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) {
            console.error('Update error:', error)
            return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('API Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
