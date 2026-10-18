"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ExternalLink } from "lucide-react"

export type CustomerDetails = {
    id: string
    name: string
    kana?: string | null
    phone?: string | null
    email?: string | null
    line_id?: string | null
    customer_type?: string | null
    notes?: string | null
    lstep_url?: string | null
}

function webLink(value?: string | null) {
    if (!value) return null
    try {
        const url = new URL(value)
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null
    } catch { return null }
}

export function CustomerDetailDialog({ customer, open, onOpenChange }: { customer: CustomerDetails | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    if (!customer) return null
    const link = webLink(customer.lstep_url)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>顧客情報の詳細</DialogTitle>
                    <DialogDescription>閲覧専用</DialogDescription>
                </DialogHeader>
                <dl className="grid gap-4 py-4 text-sm">
                    {[
                        ['お名前', customer.name], ['フリガナ', customer.kana], ['メールアドレス', customer.email],
                        ['電話番号', customer.phone], ['顧客属性', customer.customer_type], ['LINE ID', customer.line_id],
                    ].map(([label, value]) => (
                        <div key={label}>
                            <dt className="mb-1 font-medium text-slate-500">{label}</dt>
                            <dd className="break-words text-slate-900">{value || '（登録なし）'}</dd>
                        </div>
                    ))}
                    <div className="rounded-md border border-green-100 bg-green-50/50 p-3">
                        <dt className="mb-2 font-medium text-green-800">Lステップ連携 URL</dt>
                        <dd className="break-all">
                            {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 underline">管理画面を開く<ExternalLink className="h-3 w-3" /></a> : customer.lstep_url || '（登録なし）'}
                        </dd>
                    </div>
                    <div>
                        <dt className="mb-2 font-medium text-slate-500">特記事項・メモ</dt>
                        <dd className="whitespace-pre-wrap break-words rounded-md border p-3">{customer.notes || '（記録なし）'}</dd>
                    </div>
                </dl>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>閉じる</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
