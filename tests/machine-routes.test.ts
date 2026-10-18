import { afterEach, expect, it, vi } from 'vitest'
import { GET as syncSheets } from '@/app/api/cron/sync-sheets/route'
import { POST as receiveInquiry } from '@/app/api/webhooks/inquiries/route'

vi.mock('server-only', () => ({}))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

it.each([
  { name: 'cron', method: 'GET', invoke: syncSheets },
  { name: 'webhook', method: 'POST', invoke: receiveInquiry },
])('keeps $name paused even with valid machine credentials', async ({ method, invoke }) => {
  vi.stubEnv('CRON_SECRET', 'synthetic-secret')
  vi.stubEnv('WEBHOOK_SECRET_TOKEN', 'synthetic-secret')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-machine-key')
  const fetchBoundary = vi.fn(() => { throw new Error('Paused imports must not contact any service') })
  vi.stubGlobal('fetch', fetchBoundary)
  const request = new Request('https://crm.test/api/machine', {
    method, headers: { authorization: 'Bearer synthetic-secret' },
    ...(method === 'POST' ? { body: '{malformed' } : {}),
  })
  const readBody = vi.spyOn(request, 'json')
  const response = await invoke()
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(await response.json()).not.toHaveProperty('success', true)
  expect(readBody).not.toHaveBeenCalled()
  expect(fetchBoundary).not.toHaveBeenCalled()
})
