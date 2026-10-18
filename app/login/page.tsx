import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-medium text-blue-700">統合問い合わせ管理システム</p>
        <h1 className="text-2xl font-bold text-slate-900">ログイン</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">登録済みのメールアドレスに確認コードを送信する。許可されたアカウントだけが利用できる。</p>
        {error === 'access' && <p role="alert" className="mt-4 text-sm text-red-700">このアカウントには利用権限がない。</p>}
        <LoginForm />
      </section>
    </main>
  )
}
