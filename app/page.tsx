import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Users } from "lucide-react"
import { InquiriesTable } from "@/components/inquiries-table"
import { CustomersTable } from "@/components/customers-table"
import type { InquiryDetails } from "@/components/inquiry-detail-dialog"
import type { CustomerDetails } from "@/components/customer-detail-dialog"
import { requireMemberPage } from "@/src/lib/auth"
import { LogoutButton } from "@/components/logout-button"

export const revalidate = 0
const PAGE_SIZE = 50

type SearchParams = { tab?: string | string[]; page?: string | string[] }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await requireMemberPage()
  const params = await searchParams
  const tab = params.tab === 'customers' ? 'customers' : 'inquiries'
  const requestedPage = typeof params.page === 'string' && /^[1-9]\d*$/.test(params.page) ? Number(params.page) : 1
  const page = Number.isSafeInteger(requestedPage * PAGE_SIZE) ? requestedPage : 1
  const first = (page - 1) * PAGE_SIZE
  const query = tab === 'inquiries'
    ? supabase.from('inquiries').select('*, customers(name)', { count: 'exact' }).order('received_at', { ascending: false, nullsFirst: false })
    : supabase.from('customers').select('*', { count: 'exact' }).order('created_at', { ascending: false, nullsFirst: false })
  const { data, count, error } = await query
    .order('id', { ascending: false })
    .range(first, first + PAGE_SIZE - 1)

  // PostgREST returns 416 with no count when the requested offset is past the end.
  if (error?.code === 'PGRST103' && page > 1) redirect(`/?tab=${tab}&page=1`)
  const failed = !!error || count === null || !data
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (!failed && page > totalPages) redirect(`/?tab=${tab}&page=${totalPages}`)
  const rows = data ?? []

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="sticky top-0 z-30 flex min-h-16 w-full items-center justify-between gap-4 border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center justify-center rounded-md bg-blue-600 p-2">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">統合問い合わせ管理システム</h1>
          <Badge variant="outline" className="font-medium">閲覧専用</Badge>
        </div>
        <LogoutButton />
      </header>

      <main className="flex-1 space-y-6 p-4 py-6 sm:p-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">顧客・対応履歴の閲覧</h2>
          <p className="mt-1 text-slate-500">保存されている顧客情報と過去の対応履歴を確認できる。</p>
        </div>

        <nav aria-label="表示する一覧" className="inline-flex flex-wrap gap-1 rounded-lg border bg-white p-1 text-slate-600">
          <Link href="/?tab=inquiries&page=1" prefetch={false} aria-current={tab === 'inquiries' ? 'page' : undefined}
            className={`flex items-center rounded-md px-4 py-2 text-sm font-medium ${tab === 'inquiries' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'hover:bg-slate-50'}`}>
            <MessageSquare className="mr-2 h-4 w-4" />タイムライン（対応履歴）
          </Link>
          <Link href="/?tab=customers&page=1" prefetch={false} aria-current={tab === 'customers' ? 'page' : undefined}
            className={`flex items-center rounded-md px-4 py-2 text-sm font-medium ${tab === 'customers' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'hover:bg-slate-50'}`}>
            <Users className="mr-2 h-4 w-4" />顧客一覧
          </Link>
        </nav>

        <Card className="border-none shadow-sm ring-1 ring-slate-200">
          <CardHeader className="border-b bg-slate-50/50 pb-4">
            <CardTitle>{tab === 'inquiries' ? '対応履歴（タイムライン）' : '顧客一覧'}</CardTitle>
            <CardDescription>行を選ぶと詳細を確認できる。1ページに最大50件を表示する。</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {failed ? (
              <p role="alert" className="p-6 text-sm text-red-700">データを読み込めなかった。時間をおいて再読み込みしてほしい。</p>
            ) : (
              <>
                {tab === 'inquiries' ? <InquiriesTable inquiries={rows as unknown as InquiryDetails[]} /> : <CustomersTable customers={rows as CustomerDetails[]} />}
                <nav aria-label="ページ送り" className="flex flex-wrap items-center justify-between gap-4 border-t p-4">
                  <p className="text-sm text-slate-600">
                    全{total}件{total > 0 ? `中 ${first + 1}〜${first + rows.length}件` : ''} · {page} / {totalPages}ページ
                  </p>
                  <div className="flex gap-2">
                    {page > 1 ? <Button variant="outline" asChild><Link rel="prev" prefetch={false} href={`/?tab=${tab}&page=${page - 1}`}>前の50件</Link></Button> : <Button variant="outline" disabled>前の50件</Button>}
                    {page < totalPages ? <Button variant="outline" asChild><Link rel="next" prefetch={false} href={`/?tab=${tab}&page=${page + 1}`}>次の50件</Link></Button> : <Button variant="outline" disabled>次の50件</Button>}
                  </div>
                </nav>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
