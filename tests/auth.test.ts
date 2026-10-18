import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: null as null | { id: string },
  authError: null as null | { message: string },
  member: false,
  rpcError: null as null | { message: string },
  calls: 0,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/src/lib/supabase', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: state.authError }) },
    rpc: async () => ({ data: state.member, error: state.rpcError }),
  }),
}))
import { withMember } from '@/src/lib/auth'

beforeEach(() => Object.assign(state, { user: null, authError: null, member: false, rpcError: null, calls: 0 }))
const read = () => new Request('https://crm.test/api/customers/suggestions')
const mutation = (origin?: string) => new Request('https://crm.test/api/inquiries', {
  method: 'POST', headers: origin ? { origin } : {},
})
const data = async () => { state.calls++; return Response.json({ records: ['synthetic'] }) }

describe('server-side membership enforcement', () => {
  it('rejects an absent or forged identity before business data can be read', async () => {
    state.authError = { message: 'invalid token' }
    const response = await withMember(read(), data)
    expect(response.status).toBe(401)
    expect(state.calls).toBe(0)
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it('rejects a valid identity that is not an approved member', async () => {
    state.user = { id: 'unapproved' }
    expect((await withMember(read(), data)).status).toBe(403)
    expect(state.calls).toBe(0)
  })
  it('fails closed when membership lookup is unavailable', async () => {
    state.user = { id: 'approved' }; state.member = true
    state.rpcError = { message: 'database unavailable' }
    expect((await withMember(read(), data)).status).toBe(503)
    expect(state.calls).toBe(0)
  })
  it('returns approved data without allowing shared caching', async () => {
    state.user = { id: 'approved' }; state.member = true
    const response = await withMember(read(), data)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ records: ['synthetic'] })
    expect(response.headers.get('cache-control')).toContain('private')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it.each([undefined, 'null', 'https://evil.test', 'https://crm.test.evil.test'])('blocks business mutations regardless of origin %s', async origin => {
    state.user = { id: 'approved' }; state.member = true
    expect((await withMember(mutation(origin), data)).status).toBe(405)
    expect(state.calls).toBe(0)
  })
  it('rejects same-origin business mutation even for an approved member', async () => {
    state.user = { id: 'approved' }; state.member = true
    expect((await withMember(mutation('https://crm.test'), data)).status).toBe(405)
    expect(state.calls).toBe(0)
  })
  it('rechecks membership after revocation, even with the same valid identity', async () => {
    state.user = { id: 'approved' }; state.member = true
    expect((await withMember(read(), data)).status).toBe(200)
    state.member = false
    expect((await withMember(read(), data)).status).toBe(403)
    expect(state.calls).toBe(1)
  })
})
