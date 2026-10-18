import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createClient } from './supabase'
import { readOnlyResponse } from './read-only'

export function privateResponse(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}

export function authResponse(status: number, error: string) {
  return privateResponse(Response.json({ error }, { status }))
}

export function isSameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin
}

type MemberAccess = { client: SupabaseClient; response?: never } | { client?: never; response: Response }

export async function memberAccess(): Promise<MemberAccess> {
  try {
    const client = await createClient()
    // The cookie alone is not identity evidence: Auth must validate it.
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return { response: authResponse(401, 'ログインが必要だ。') }
    const membership = await client.rpc('is_crm_member')
    if (membership.error) return { response: authResponse(503, '利用権限を確認できない。時間をおいて再度試してほしい。') }
    if (membership.data !== true) return { response: authResponse(403, 'このアカウントには利用権限がない。') }
    return { client }
  } catch {
    return { response: authResponse(503, 'ログイン状態を確認できない。時間をおいて再度試してほしい。') }
  }
}

export async function requireMemberPage() {
  const access = await memberAccess()
  if (access.response) {
    if (access.response.status === 503) throw new Error('CRM access service unavailable')
    redirect(access.response.status === 403 ? '/login?error=access' : '/login')
  }
  return access.client
}

export async function withMember(request: Request, handler: (client: SupabaseClient) => Promise<Response>) {
  if (!['GET', 'HEAD'].includes(request.method)) return readOnlyResponse()
  const access = await memberAccess()
  if (access.response) return access.response
  return privateResponse(await handler(access.client))
}
