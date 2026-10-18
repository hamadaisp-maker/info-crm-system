'use client'

import { useState } from 'react'
import { Button } from './ui/button'

export function LogoutButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function logout() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('logout failed')
      window.location.replace('/login')
    } catch { setError('ログアウトできなかった。再度試してほしい。'); setBusy(false) }
  }
  return <div>
    <Button variant="outline" disabled={busy} onClick={logout}>{busy ? '処理中…' : 'ログアウト'}</Button>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>
}
