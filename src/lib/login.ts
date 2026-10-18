import 'server-only'
import { createClient } from './supabase'
import { authResponse, isSameOrigin, privateResponse } from './auth'

async function input(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.email !== 'string') return null
  const email = body.email.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return { email, code: typeof body.code === 'string' ? body.code.trim() : '' }
}

export async function requestCode(request: Request) {
  if (!isSameOrigin(request)) return authResponse(403, 'ログイン画面から操作してほしい。')
  const body = await input(request)
  if (!body) return authResponse(400, 'メールアドレスを確認してほしい。')
  try {
    const client = await createClient()
    // The same public response is returned for known and unknown accounts.
    await client.auth.signInWithOtp({ email: body.email, options: { shouldCreateUser: false } })
    return privateResponse(Response.json({ message: '登録済みのメールアドレスなら確認コードが届く。届いたコードを入力してほしい。' }, { status: 202 }))
  } catch {
    return authResponse(503, 'メール送信に接続できない。時間をおいて再度試してほしい。')
  }
}

export async function verifyCode(request: Request) {
  if (!isSameOrigin(request)) return authResponse(403, 'ログイン画面から操作してほしい。')
  const body = await input(request)
  if (!body || !/^\d{6,10}$/.test(body.code)) return authResponse(400, 'メールアドレスと確認コードを確認してほしい。')
  try {
    const client = await createClient()
    const { data, error } = await client.auth.verifyOtp({ email: body.email, token: body.code, type: 'email' })
    if (error || !data.user) return authResponse(401, 'コードが違うか、有効期限が切れている。')
    const membership = await client.rpc('is_crm_member')
    if (membership.error || membership.data !== true) {
      await client.auth.signOut({ scope: 'local' })
      return membership.error
        ? authResponse(503, '利用権限を確認できない。時間をおいて再度試してほしい。')
        : authResponse(403, 'このアカウントには利用権限がない。')
    }
    return privateResponse(Response.json({ success: true }))
  } catch {
    return authResponse(503, 'ログインを完了できない。時間をおいて再度試してほしい。')
  }
}

export async function logout(request: Request) {
  if (!isSameOrigin(request)) return authResponse(403, 'この画面から操作をやり直してほしい。')
  try {
    const client = await createClient()
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) return authResponse(503, 'ログアウトできなかった。再度試してほしい。')
    return privateResponse(Response.json({ success: true }))
  } catch {
    return authResponse(503, 'ログアウトできなかった。再度試してほしい。')
  }
}
