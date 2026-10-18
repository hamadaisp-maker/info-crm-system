import { requireMemberPage } from '@/src/lib/auth'

export async function fetchCustomers() {
    const supabase = await requireMemberPage()
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching customers:', error)
        return []
    }
    return data
}

export async function fetchInquiries() {
    const supabase = await requireMemberPage()
    const { data, error } = await supabase
        .from('inquiries')
        .select(`
      *,
      customers (
        name
      )
    `)
        .order('received_at', { ascending: false })

    if (error) {
        console.error('Error fetching inquiries:', error)
        return []
    }
    return data
}
