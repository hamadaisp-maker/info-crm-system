import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  calls: [] as { kind: string; input: unknown }[], otpError: false, validCode: false,
  member: true, membershipError: false, logoutError: false,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/src/lib/supabase', () => ({ createClient: async () => ({
  auth: {
    signInWithOtp: async (input: unknown) => { state.calls.push({ kind: 'request', input }); return { error: state.otpError ? { message: 'unknown email' } : null } },
    verifyOtp: async (input: unknown) => { state.calls.push({ kind: 'verify', input }); return { data: { user: state.validCode ? { id: 'synthetic-member' } : null }, error: state.validCode ? null : { message: 'expired' } } },
    signOut: async (input: unknown) => { state.calls.push({ kind: 'logout', input }); return { error: state.logoutError ? { message: 'offline' } : null } },
  },
  rpc: async () => ({ data: state.member, error: state.membershipError ? { message: 'offline' } : null }),
}) }))
import { requestCode, verifyCode, logout } from '@/src/lib/login'

beforeEach(() => Object.assign(state, { calls: [], otpError: false, validCode: false, member: true, membershipError: false, logoutError: false }))
function request(body: unknown, origin = 'https://crm.test') {
  return new Request('https://crm.test/api/auth/test', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

it('never lets the login endpoint register an unapproved account', async () => {
  expect((await requestCode(request({ email: 'member@example.test' }))).status).toBe(202)
  expect(state.calls).toEqual([{ kind: 'request', input: { email: 'member@example.test', options: { shouldCreateUser: false } } }])
})
it('does not disclose whether an email address exists', async () => {
  const known = await requestCode(request({ email: 'member@example.test' }))
  state.otpError = true
  const unknown = await requestCode(request({ email: 'unknown@example.test' }))
  expect(unknown.status).toBe(known.status)
  expect(await unknown.json()).toEqual(await known.json())
})
it.each([requestCode, verifyCode, logout])('refuses cross-site authentication changes', async handler => {
  expect((await handler(request({ email: 'member@example.test', code: '123456' }, 'https://evil.test'))).status).toBe(403)
  expect(state.calls).toEqual([])
})
it('rejects malformed email and codes without sending them to Auth', async () => {
  expect((await requestCode(request({ email: 'not-an-email' }))).status).toBe(400)
  expect((await verifyCode(request({ email: 'member@example.test', code: 'invalid' }))).status).toBe(400)
  expect(state.calls).toEqual([])
})
it('rejects an expired or wrong code', async () => {
  expect((await verifyCode(request({ email: 'member@example.test', code: '123456' }))).status).toBe(401)
})
it('a valid code still cannot authorize a nonmember and its session is cleared', async () => {
  state.validCode = true; state.member = false
  expect((await verifyCode(request({ email: 'outsider@example.test', code: '123456' }))).status).toBe(403)
  expect(state.calls.at(-1)).toEqual({ kind: 'logout', input: { scope: 'local' } })
})
it('membership outages fail closed after code verification', async () => {
  state.validCode = true; state.membershipError = true
  expect((await verifyCode(request({ email: 'member@example.test', code: '123456' }))).status).toBe(503)
})
it('accepts a valid code only for an approved member and prevents caching', async () => {
  state.validCode = true
  const response = await verifyCode(request({ email: 'member@example.test', code: '123456' }))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(state.calls[0]).toEqual({ kind: 'verify', input: { email: 'member@example.test', token: '123456', type: 'email' } })
})
it('logs out the current browser session', async () => {
  const response = await logout(request({}))
  expect(response.status).toBe(200)
  expect(state.calls).toEqual([{ kind: 'logout', input: { scope: 'local' } }])
})
it('does not claim logout succeeded when session revocation fails', async () => {
  state.logoutError = true
  expect((await logout(request({}))).status).toBe(503)
})
