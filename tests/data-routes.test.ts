import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as suggestions } from '@/app/api/customers/suggestions/route'
import { PATCH as updateCustomer } from '@/app/api/customers/[id]/route'
import { POST as mergeCustomers } from '@/app/api/customers/merge/route'
import { POST as createInquiry } from '@/app/api/inquiries/route'
import { PATCH as updateInquiry } from '@/app/api/inquiries/[id]/route'
import { POST as importInquiries } from '@/app/api/inquiries/import/route'

const dependency = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/src/lib/supabase', () => ({ createClient: dependency.createClient }))
beforeEach(() => dependency.createClient.mockReset())

const writes = [
  { name: 'customer update', method: 'PATCH', invoke: () => updateCustomer() },
  { name: 'customer merge', method: 'POST', invoke: mergeCustomers },
  { name: 'inquiry creation', method: 'POST', invoke: createInquiry },
  { name: 'inquiry update', method: 'PATCH', invoke: () => updateInquiry() },
  { name: 'inquiry import', method: 'POST', invoke: importInquiries },
]

describe.each(writes)('$name is disabled', ({ method, invoke }) => {
  it.each([false, true])('cannot write with member session=%s', async member => {
    dependency.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: member ? { id: 'member' } : null }, error: null }) },
      rpc: async () => ({ data: member, error: null }),
      from: () => { throw new Error('Unexpected business access') },
    })
    const request = new Request('https://crm.test/api/disabled', {
      method, headers: { origin: 'https://crm.test', cookie: 'synthetic-session', 'content-type': 'application/json' }, body: '{malformed',
    })
    const readBody = vi.spyOn(request, 'json')
    const response = await invoke()
    expect(response.status).toBe(405)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(readBody).not.toHaveBeenCalled()
    expect(dependency.createClient).not.toHaveBeenCalled()
  })
})

it.each([
  { user: null, member: false, status: 401 },
  { user: { id: 'outsider' }, member: false, status: 403 },
])('protects the remaining read API with status $status', async ({ user, member, status }) => {
  const from = vi.fn()
  dependency.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user }, error: null }) }, rpc: async () => ({ data: member, error: null }), from })
  expect((await suggestions(new Request('https://crm.test/api/customers/suggestions?name=Test'))).status).toBe(status)
  expect(from).not.toHaveBeenCalled()
})

it('allows only a member to read customer suggestions without shared caching', async () => {
  const records = [{ id: 'synthetic', name: 'Synthetic customer' }]
  const query = { select: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: records, error: null }) }
  dependency.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'member' } }, error: null }) }, rpc: async () => ({ data: true, error: null }), from: () => query })
  const response = await suggestions(new Request('https://crm.test/api/customers/suggestions?name=Test'))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ suggestions: records })
  expect(response.headers.get('cache-control')).toContain('no-store')
})
