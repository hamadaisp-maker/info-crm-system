"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MessageSquare } from "lucide-react"

export type InquiryDetails = {
    id: string
    company: string
    channel: string
    direction: string
    status: string
    received_at?: string | null
    customers?: { name?: string | null } | null
    original_sender?: string | null
    subject?: string | null
    content?: string | null
    answer?: string | null
    notes?: string | null
    category?: string | null
    assignee?: string | null
    source_account?: string | null
}

export function formatInquiryDate(value?: string | null) {
    if (!value) return '-'
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return '-'
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(date)
}

export function InquiryDetailDialog({ inquiry, open, onOpenChange }: { inquiry: InquiryDetails | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    if (!inquiry) return null
    const status = inquiry.status || '未対応'
    const received = formatInquiryDate(inquiry.received_at)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <DialogTitle className="text-xl">対応内容の詳細</DialogTitle>
                            <DialogDescription>閲覧専用{received !== '-' ? ` · ${received}（日本時間）の記録` : ''}</DialogDescription>
                        </div>
                        <Badge className={`mt-1 border-none shadow-none text-sm px-3 py-1 ${status === '対応中' ? 'bg-amber-100 text-amber-800' : status === '未対応' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            ステータス: {status}
                        </Badge>
                    </div>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <dl className="grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
                        <div>
                            <dt className="mb-1 text-xs text-slate-500">顧客名</dt>
                            <dd className="font-medium">{inquiry.customers?.name || '不明'} 様
                                {inquiry.original_sender && <span className="ml-2 text-xs font-normal text-slate-400">(LINE名: {inquiry.original_sender})</span>}
                            </dd>
                        </div>
                        <div>
                            <dt className="mb-1 text-xs text-slate-500">会社 / チャネル</dt>
                            <dd className="flex flex-wrap items-center gap-2">
                                <span className="text-sm">{inquiry.company}</span>
                                <Badge variant="outline" className="bg-white">
                                    {inquiry.channel === '電話' && <Phone className="mr-1 h-3 w-3" />}
                                    {inquiry.channel === 'Email' && <Mail className="mr-1 h-3 w-3" />}
                                    {inquiry.channel === 'LINE' && <MessageSquare className="mr-1 h-3 w-3" />}
                                    {inquiry.channel} ({inquiry.direction})
                                </Badge>
                            </dd>
                        </div>
                        {[
                            ['分類', inquiry.category], ['担当者', inquiry.assignee], ['流入元', inquiry.source_account],
                        ].map(([label, value]) => value ? <div key={label}><dt className="mb-1 text-xs text-slate-500">{label}</dt><dd className="break-words text-sm">{value}</dd></div> : null)}
                    </dl>
                    <dl className="space-y-4">
                        {[
                            ['件名', inquiry.subject], ['問い合わせ内容・架電内容', inquiry.content], ['返答・対応結果', inquiry.answer], ['社内メモ・引き継ぎ事項', inquiry.notes],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <dt className="mb-2 border-b pb-1 font-medium text-slate-900">{label}</dt>
                                <dd className="whitespace-pre-wrap break-words rounded-md border bg-white p-3 text-sm">{value || '（記録なし）'}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>閉じる</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
