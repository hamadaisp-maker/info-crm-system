import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, MessageSquare, Phone, Mail, Users, FileText } from "lucide-react"
import { fetchInquiries, fetchCustomers } from "@/src/lib/api"
import { format } from "date-fns"
import { NewRegistrationDialog } from "@/components/new-registration-dialog"
import { InquiriesTable } from "@/components/inquiries-table"
import { CustomersTable } from "@/components/customers-table"
import { CSVImportDialog } from "@/components/csv-import-dialog"
import { createClient } from "@/src/lib/supabase"

export const revalidate = 0 // 常に最新のデータを取得

export default async function DashboardPage() {
  const supabase = createClient() // Supabaseクライアントの初期化を追加

  const { data: inquiries, error: inquiriesError } = await supabase
    .from("inquiries")
    .select(`
      *,
      original_sender,
      customers (
        name,
        company:customer_type
      )
    `)
    .order("received_at", { ascending: false })
    .limit(20)

  if (inquiriesError) {
    console.error("Error fetching inquiries:", inquiriesError)
    // エラーハンドリングを適切に行う
    return <div>Error loading inquiries.</div>
  }

  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("*")

  if (customersError) {
    console.error("Error fetching customers:", customersError)
    // エラーハンドリングを適切に行う
    return <div>Error loading customers.</div>
  }

  // 集計用データ
  const unresolvedCount = inquiries.filter((i: any) => i.status !== '完了').length
  const todayPhones = inquiries.filter((i: any) => i.channel === '電話').length
  const todayMails = inquiries.filter((i: any) => i.channel === 'Email' || i.channel === 'LINE').length
  const completedCount = inquiries.filter((i: any) => i.status === '完了').length

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* 共通ヘッダー */}
      <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center rounded-md bg-blue-600 p-2">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            統合問い合わせ管理システム
          </h1>
          <Badge variant="outline" className="ml-2 font-medium">
            Beta
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="顧客名やメールで検索..."
              className="w-64 bg-slate-100/50 pl-8 focus-visible:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <CSVImportDialog customers={customers} />
            <NewRegistrationDialog />
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-8 py-6">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
            <p className="text-slate-500">日本認知症協会およびJapanRecordの顧客・問い合わせを一元管理します。</p>
          </div>
        </div>

        <Tabs defaultValue="inquiries" className="space-y-4">
          <TabsList className="bg-white border text-slate-600 h-11 p-1">
            <TabsTrigger value="inquiries" className="px-6 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
              <MessageSquare className="mr-2 h-4 w-4" /> タイムライン（対応履歴）
            </TabsTrigger>
            <TabsTrigger value="customers" className="px-6 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
              <Users className="mr-2 h-4 w-4" /> 顧客一覧（全員）
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inquiries" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-none shadow-sm ring-1 ring-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">未対応の問い合わせ</CardTitle>
                  <Filter className="h-4 w-4 text-rose-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{unresolvedCount}件</div>
                  <p className="text-xs text-slate-500 mt-1">至急対応が必要です</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm ring-1 ring-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">電話対応</CardTitle>
                  <Phone className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{todayPhones}件</div>
                  <p className="text-xs text-slate-500 mt-1">すべての期間の集計</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm ring-1 ring-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">メール/LINE対応</CardTitle>
                  <Mail className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{todayMails}件</div>
                  <p className="text-xs text-slate-500 mt-1">すべての期間の集計</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm ring-1 ring-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">対応完了</CardTitle>
                  <FileText className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{completedCount}件</div>
                  <p className="text-xs text-slate-500 mt-1">順調に処理されています</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle>直近の対応履歴（タイムライン）</CardTitle>
                <CardDescription>
                  最新の問い合わせや架電連絡事項の履歴が表示されます。クリックして詳細を確認・返信できます。
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <InquiriesTable inquiries={inquiries} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <Card className="border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle>顧客一覧</CardTitle>
                <CardDescription>
                  両社に登録されているすべての顧客データを表示しています。
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <CustomersTable customers={customers} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
