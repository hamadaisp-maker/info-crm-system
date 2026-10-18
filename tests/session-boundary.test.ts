import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@/src/lib/supabase'
import { requireMemberPage } from '@/src/lib/auth'
import { proxy } from '@/proxy'

type Cookie = { name: string; value: string }
type CookieOptions = { httpOnly?: boolean; secure?: boolean; sameSite?: string | boolean; maxAge?: number }
type CookieStore = { getAll: () => Cookie[]; set: (name: string, value: string, options?: CookieOptions) => void }
const nextBoundary = vi.hoisted(() => ({
  store: null as CookieStore | null,
  redirect: vi.fn((path: string): never => { throw new Error(`redirect:${path}`) }),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => nextBoundary.store }))
vi.mock('next/navigation', () => ({ redirect: nextBoundary.redirect }))

const cookieName = 'sb-synthetic-auth-token'
let tokenUsers: Map<string, string>
let members: Set<string>
let refreshedSessions: Map<string, ReturnType<typeof session>>
let fetchBoundary: ReturnType<typeof vi.fn>
let businessReads: number

function session(id: string, expired = false) {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + (expired ? -3600 : 3600)
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: expiresAt, iat: now - 7200, role: 'authenticated' })}.synthetic-signature`
  tokenUsers.set(token, id)
  return {
    access_token: token, refresh_token: `synthetic-refresh-${id}`, expires_at: expiresAt,
    expires_in: 3600, token_type: 'bearer', user: { id, email: `${id}@example.test` },
  }
}

function encodedCookie(value: ReturnType<typeof session>) {
  return `base64-${Buffer.from(JSON.stringify(value)).toString('base64url')}`
}

function cookieStore(initial?: ReturnType<typeof session>) {
  const values = new Map(initial ? [[cookieName, encodedCookie(initial)]] : [])
  return {
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    set: vi.fn((name: string, value: string) => { values.set(name, value) }),
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  tokenUsers = new Map()
  members = new Set(['member-a', 'member-b'])
  refreshedSessions = new Map()
  businessReads = 0
  nextBoundary.store = cookieStore()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-anon-key')

  // Keep the real SSR client, cookie encoding, session refresh, NextRequest and
  // NextResponse. Only external Auth/PostgREST and Next's request store are fake.
  fetchBoundary = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.host !== 'synthetic.supabase.co') throw new Error('Unexpected outbound host in session test')
    const headers = new Headers(init?.headers)
    const userId = tokenUsers.get(headers.get('authorization')?.replace(/^Bearer /, '') ?? '')
    if (url.pathname === '/auth/v1/token') {
      expect(url.searchParams.get('grant_type')).toBe('refresh_token')
      const refreshToken = JSON.parse(String(init?.body)).refresh_token as string
      const refreshed = refreshedSessions.get(refreshToken)
      return refreshed ? json(refreshed) : json({ code: 'refresh_token_not_found', message: 'Invalid synthetic refresh token' }, 400)
    }
    if (url.pathname === '/auth/v1/user') {
      return userId ? json({ id: userId, email: `${userId}@example.test` }) : json({ code: 'bad_jwt', message: 'Invalid synthetic token' }, 401)
    }
    if (url.pathname === '/rest/v1/rpc/is_crm_member') return json(!!userId && members.has(userId))
    if (url.pathname === '/rest/v1/customers') {
      businessReads++
      return json([{ id: 'synthetic-customer' }])
    }
    throw new Error('Unexpected service operation in session test')
  })
  vi.stubGlobal('fetch', fetchBoundary)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('proxy cookie refresh', () => {
  it('passes the refreshed session to the downstream request and the browser with private caching', async () => {
    const expired = session('member-a', true)
    const refreshed = session('member-a')
    refreshedSessions.set(expired.refresh_token, refreshed)
    const request = new NextRequest('https://crm.test/', { headers: { cookie: `${cookieName}=${encodedCookie(expired)}` } })
    const response = await proxy(request)

    const browserCookie = response.cookies.get(cookieName)
    expect(browserCookie?.value).toBe(encodedCookie(refreshed))
    expect(request.cookies.get(cookieName)?.value).toBe(browserCookie?.value)
    expect(response.headers.get('x-middleware-request-cookie')).toContain(`${cookieName}=${browserCookie?.value}`)
    expect(browserCookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(businessReads).toBe(0)
  })

  it('keeps anonymous responses private without attempting a business read', async () => {
    const response = await proxy(new NextRequest('https://crm.test/'))
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('cache-control')).toContain('private')
    expect(response.cookies.getAll()).toHaveLength(0)
    expect(fetchBoundary).not.toHaveBeenCalled()
    expect(businessReads).toBe(0)
  })
})

it('keeps two SSR clients and refreshed cookies attached to their own requests', async () => {
  const firstSession = session('member-a', true)
  const secondSession = session('member-b', true)
  const firstRefreshed = session('member-a')
  const secondRefreshed = session('member-b')
  refreshedSessions.set(firstSession.refresh_token, firstRefreshed)
  refreshedSessions.set(secondSession.refresh_token, secondRefreshed)
  const firstStore = cookieStore(firstSession)
  const secondStore = cookieStore(secondSession)
  nextBoundary.store = firstStore
  const firstClient = await createClient()
  nextBoundary.store = secondStore
  const secondClient = await createClient()

  const [firstUser, secondUser] = await Promise.all([firstClient.auth.getUser(), secondClient.auth.getUser()])
  expect(firstClient).not.toBe(secondClient)
  expect(firstUser.data.user?.id).toBe('member-a')
  expect(secondUser.data.user?.id).toBe('member-b')
  expect(firstStore.getAll().find(cookie => cookie.name === cookieName)?.value).toBe(encodedCookie(firstRefreshed))
  expect(secondStore.getAll().find(cookie => cookie.name === cookieName)?.value).toBe(encodedCookie(secondRefreshed))
  expect(firstStore.set).toHaveBeenCalledWith(cookieName, encodedCookie(firstRefreshed), expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' }))
  expect(secondStore.set).toHaveBeenCalledWith(cookieName, encodedCookie(secondRefreshed), expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' }))
})

describe('page membership gate with a real SSR client', () => {
  it('redirects an anonymous request before fetching any business data', async () => {
    await expect(requireMemberPage()).rejects.toThrow('redirect:/login')
    expect(nextBoundary.redirect).toHaveBeenCalledWith('/login')
    expect(fetchBoundary).not.toHaveBeenCalled()
    expect(businessReads).toBe(0)
  })

  it('redirects an authenticated outsider before fetching business data', async () => {
    nextBoundary.store = cookieStore(session('outsider'))
    await expect(requireMemberPage()).rejects.toThrow('redirect:/login?error=access')
    expect(nextBoundary.redirect).toHaveBeenCalledWith('/login?error=access')
    expect(businessReads).toBe(0)
  })

  it('returns a data client only after Auth and membership checks succeed', async () => {
    nextBoundary.store = cookieStore(session('member-a'))
    const client = await requireMemberPage()
    expect(nextBoundary.redirect).not.toHaveBeenCalled()
    expect(businessReads).toBe(0)
    const { data, error } = await client.from('customers').select('id')
    expect(error).toBeNull()
    expect(data).toEqual([{ id: 'synthetic-customer' }])
    expect(businessReads).toBe(1)
    expect(fetchBoundary.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      '/auth/v1/user', '/rest/v1/rpc/is_crm_member', '/rest/v1/customers',
    ])
  })
})
