import { expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CustomerDetailDialog } from '@/components/customer-detail-dialog'
import { InquiryDetailDialog, formatInquiryDate } from '@/components/inquiry-detail-dialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/components/ui/dialog', () => {
  const wrapper = ({ children }: { children: ReactNode }) => createElement('section', null, children)
  return { Dialog: wrapper, DialogContent: wrapper, DialogDescription: wrapper, DialogFooter: wrapper, DialogHeader: wrapper, DialogTitle: wrapper }
})

it.each(['javascript:alert(1)', 'data:text/html,test', '//example.test/relative'])('does not make an unsafe saved URL clickable: %s', url => {
  const html = renderToStaticMarkup(createElement(CustomerDetailDialog, {
    customer: { id: 'synthetic', name: 'Synthetic customer', lstep_url: url }, open: true, onOpenChange: () => {},
  }))
  expect(html).not.toContain('href=')
  expect(html).not.toMatch(/<input|<textarea|<select|保存|統合/)
  expect(html).toContain('閲覧専用')
})

it('keeps an HTTPS customer link available and displays notes as text', () => {
  const html = renderToStaticMarkup(createElement(CustomerDetailDialog, {
    customer: { id: 'synthetic', name: 'Synthetic customer', notes: '<script>synthetic</script>', lstep_url: 'https://example.test/customer' }, open: true, onOpenChange: () => {},
  }))
  expect(html).toContain('href="https://example.test/customer"')
  expect(html).toContain('rel="noopener noreferrer"')
  expect(html).toContain('&lt;script&gt;synthetic&lt;/script&gt;')
})

it('renders the existing inquiry response and notes without editable controls', () => {
  const html = renderToStaticMarkup(createElement(InquiryDetailDialog, {
    inquiry: { id: 'synthetic', company: 'JapanRecord', channel: 'Email', direction: 'IN', status: '完了', content: 'Synthetic content', answer: 'Synthetic answer', notes: 'Synthetic note' },
    open: true, onOpenChange: () => {},
  }))
  expect(html).toContain('Synthetic content')
  expect(html).toContain('Synthetic answer')
  expect(html).toContain('Synthetic note')
  expect(html).not.toMatch(/<input|<textarea|<select|保存|ステータス変更/)
  expect(html).toContain('閲覧専用')
})

it('shows stored timestamps in Japan time regardless of the server timezone', () => {
  vi.stubEnv('TZ', 'UTC')
  try {
    expect(formatInquiryDate('2026-01-02T03:30:00.000Z')).toBe('2026/01/02 12:30')
    expect(formatInquiryDate(null)).toBe('-')
    expect(formatInquiryDate('invalid')).toBe('-')
  } finally { vi.unstubAllEnvs() }
})
