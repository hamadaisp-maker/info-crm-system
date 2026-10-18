'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!remaining) return
    const timer = setTimeout(() => setRemaining(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  async function sendCode() {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/auth/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const result = await response.json()
      if (!response.ok) { setError(result.error || '確認コードを送信できなかった。'); return }
      setSent(true); setCode(''); setRemaining(60); setMessage(result.message)
    } catch { setError('通信できない。接続を確認して再度試してほしい。') }
    finally { setBusy(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sent) { await sendCode(); return }
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) })
      const result = await response.json()
      if (!response.ok) { setError(result.error || 'ログインできなかった。'); return }
      setCode('')
      window.location.replace('/')
    } catch { setError('通信できない。接続を確認して再度試してほしい。') }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">メールアドレス</label>
        <Input id="email" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy || sent} onChange={event => setEmail(event.target.value)} />
      </div>
      {sent && <div className="space-y-2">
        <label htmlFor="code" className="text-sm font-medium">確認コード</label>
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required autoFocus value={code} disabled={busy} onChange={event => setCode(event.target.value)} />
      </div>}
      {message && <p role="status" className="text-sm leading-6 text-slate-600">{message}</p>}
      {error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}
      <Button className="w-full" type="submit" disabled={busy}>{busy ? '処理中…' : sent ? 'ログイン' : '確認コードを送信'}</Button>
      {sent && <div className="flex justify-between gap-4 text-sm">
        <button type="button" disabled={busy || remaining > 0} onClick={sendCode} className="text-blue-700 disabled:text-slate-400">{remaining ? `${remaining}秒後に再送できる` : 'コードを再送'}</button>
        <button type="button" disabled={busy} onClick={() => { setSent(false); setCode(''); setMessage(''); setError('') }} className="text-slate-600">アドレスを変更</button>
      </div>}
    </form>
  )
}
