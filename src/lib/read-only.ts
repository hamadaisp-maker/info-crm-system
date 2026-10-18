import 'server-only'

const headers = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache' }

// These handlers deliberately do not read cookies, payloads or credentials, and
// have no database client. The temporary viewer cannot register or edit data.
export function readOnlyResponse() {
  return Response.json({ error: '暫定版は閲覧専用のため、登録・変更はできない。' }, { status: 405, headers })
}

export function importsPausedResponse() {
  return Response.json({ error: '暫定版では自動取り込みを停止している。' }, { status: 503, headers })
}
