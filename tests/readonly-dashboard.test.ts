import { beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DashboardPage from '@/app/page'
import { createClient as createSdkClient, type SupabaseClient } from '@supabase/supabase-js'

const state = vi.hoisted(() => ({
  count: 101,
  rows: [{ id: 'synthetic-1' }] as { id: string }[],
  queries: [] as { table: string; select: unknown[]; orders: unknown[][]; range?: number[] }[],
  sdkClient: null as SupabaseClient | null,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/src/lib/supabase', () => ({ createClient: async () => state.sdkClient ?? ({
  auth: { getUser: async () => ({ data: { user: { id: 'approved' } }, error: null }) },
  rpc: async () => ({ data: true, error: null }),
  from: (table: string) => {
    const tracked: typeof state.queries[number] = { table, select: [], orders: [] }
    state.queries.push(tracked)
    const result = () => ({ data: state.rows, count: state.count, error: null })
    const query = {
      select: (...args: unknown[]) => { tracked.select = args; return query },
      order: (...args: unknown[]) => { tracked.orders.push(args); return query },
      range: (from: number, to: number) => { tracked.range = [from, to]; return Promise.resolve(result()) },
      limit: async () => result(),
      then: (resolve: (value: ReturnType<typeof result>) => void) => Promise.resolve(result()).then(resolve),
    }
    return query
  },
}) }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) }, useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/components/logout-button', () => ({ LogoutButton: () => createElement('button', null, 'ログアウト') }))
vi.mock('@/components/inquiries-table', () => ({ InquiriesTable: () => createElement('div', { 'data-table': 'inquiries' }) }))
vi.mock('@/components/customers-table', () => ({ CustomersTable: () => createElement('div', { 'data-table': 'customers' }) }))

beforeEach(() => {
  state.count = 101
  state.rows = [{ id: 'synthetic-1' }]
  state.queries = []
  state.sdkClient = null
})

async function page(params: Record<string, string | string[] | undefined> = {}) {
  return renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve(params) }))
}

it('shows the first 50 inquiries in a stable order and offers the next page', async () => {
  const html = await page()
  expect(state.queries).toHaveLength(1)
  expect(state.queries[0]).toMatchObject({ table: 'inquiries', range: [0, 49], orders: [['received_at', { ascending: false, nullsFirst: false }], ['id', { ascending: false }]] })
  expect(state.queries[0].select[1]).toEqual({ count: 'exact' })
  expect(html).toContain('href="/?tab=inquiries&amp;page=2"')
  expect(html).toContain('閲覧専用')
  expect(html).toContain('ログアウト')
  expect(html).not.toMatch(/新規登録|変更を保存|インポート|type="search"|すべての期間の集計/)
})

it('preserves the customer tab on previous and next page links', async () => {
  const html = await page({ tab: 'customers', page: '2' })
  expect(state.queries).toHaveLength(1)
  expect(state.queries[0]).toMatchObject({ table: 'customers', range: [50, 99], orders: [['created_at', { ascending: false, nullsFirst: false }], ['id', { ascending: false }]] })
  expect(html).toContain('href="/?tab=customers&amp;page=1"')
  expect(html).toContain('href="/?tab=customers&amp;page=3"')
})

it.each(['0', '-1', '1.5', 'abc', '999999999999999999999', ['2', '3']].map(value => ({ value })))('normalizes an invalid page value to the first page ($value)', async ({ value }) => {
  await page({ tab: 'unknown', page: value })
  expect(state.queries[0]).toMatchObject({ table: 'inquiries', range: [0, 49] })
})

it('shows an empty result without next or previous links', async () => {
  state.rows = []
  state.count = 0
  const html = await page({ tab: 'customers' })
  expect(html).toContain('全0件')
  expect(html).not.toContain('rel="next"')
  expect(html).not.toContain('rel="prev"')
})

function useSdkWithRangeError() {
  const fetchBoundary = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.host !== 'synthetic-page.test') throw new Error('Unexpected outbound host in pagination test')
    if (url.pathname === '/rest/v1/rpc/is_crm_member') return new Response('true', { headers: { 'content-type': 'application/json' } })
    if (!['/rest/v1/inquiries', '/rest/v1/customers'].includes(url.pathname)) throw new Error('Unexpected pagination test endpoint')
    return new Response(JSON.stringify({ code: 'PGRST103', details: 'Requested offset exceeds available rows', message: 'Requested range not satisfiable' }), {
      status: 416, headers: { 'content-type': 'application/json', 'content-range': '*/101' },
    })
  })
  const client = createSdkClient('https://synthetic-page.test', 'synthetic-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchBoundary },
  })
  vi.spyOn(client.auth, 'getUser').mockResolvedValue({
    data: { user: { id: 'approved', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }, error: null,
  })
  state.sdkClient = client
  return client
}

it.each(['inquiries', 'customers'])('redirects a real SDK HTTP 416 result to the first %s page', async tab => {
  const client = useSdkWithRangeError()
  const result = await client.from(tab).select('*', { count: 'exact' }).range(150, 199)
  expect(result).toMatchObject({ status: 416, data: null, count: null, error: { code: 'PGRST103' } })
  await expect(page({ tab, page: '4' })).rejects.toThrow(`redirect:/?tab=${tab}&page=1`)
})

it('shows a range error on page one without creating a redirect loop', async () => {
  useSdkWithRangeError()
  const html = await page({ tab: 'inquiries', page: '1' })
  expect(html).toContain('role="alert"')
  expect(html).toContain('データを読み込めなかった')
})
