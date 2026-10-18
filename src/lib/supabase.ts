import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
      cookies: {
        getAll: () => store.getAll(),
        setAll(values) {
          // Server Components cannot write cookies; proxy refreshes those requests.
          try { values.forEach(({ name, value, options }) => store.set(name, value, options)) }
          catch { /* Route Handlers and proxy handle session cookie updates. */ }
        },
      },
    },
  )
}
