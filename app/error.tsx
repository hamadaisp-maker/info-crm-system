'use client'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg px-6 py-16">
    <h1 className="text-xl font-bold">現在、データを確認できない</h1>
    <p className="my-4">時間をおいて再度試してほしい。</p>
    <button onClick={reset} className="rounded bg-blue-600 px-4 py-2 text-white">もう一度読み込む</button>
  </main>
}
