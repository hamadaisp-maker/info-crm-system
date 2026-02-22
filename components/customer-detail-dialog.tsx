"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ExternalLink, Merge, Loader2 } from "lucide-react"

export function CustomerDetailDialog({ customer, open, onOpenChange }: { customer: any, open: boolean, onOpenChange: (open: boolean) => void }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    // 編集可能な項目
    const [name, setName] = useState(customer?.name || "")
    const [kana, setKana] = useState(customer?.kana || "")
    const [phone, setPhone] = useState(customer?.phone || "")
    const [email, setEmail] = useState(customer?.email || "")
    const [customerType, setCustomerType] = useState(customer?.customer_type || "")
    const [notes, setNotes] = useState(customer?.notes || "")
    const [lstepUrl, setLstepUrl] = useState(customer?.lstep_url || "")

    // マージ用状態
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false)
    const [isMerging, setIsMerging] = useState(false)

    // customerプロパティが変更されたときにステートを更新する
    useEffect(() => {
        if (customer && open) {
            setName(customer.name || "")
            setKana(customer.kana || "")
            setPhone(customer.phone || "")
            setEmail(customer.email || "")
            setCustomerType(customer.customer_type || "")
            setNotes(customer.notes || "")
            setLstepUrl(customer.lstep_url || "")
            fetchSuggestions(customer.name, customer.id)
        }
    }, [customer, open])

    const fetchSuggestions = async (searchName: string, id: string) => {
        setIsFetchingSuggestions(true)
        try {
            const res = await fetch(`/api/customers/suggestions?name=${encodeURIComponent(searchName)}&sourceId=${id}`)
            if (res.ok) {
                const data = await res.json()
                setSuggestions(data.suggestions || [])
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsFetchingSuggestions(false)
        }
    }

    // ダイアログが開かれたときに初期値をセット
    if (!customer) return null;

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/customers/${customer.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, kana, phone, email, customer_type: customerType, notes, lstep_url: lstepUrl }),
            })

            if (!res.ok) throw new Error('Failed to update')

            onOpenChange(false)
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("更新に失敗しました。")
        } finally {
            setLoading(false)
        }
    }

    const handleMerge = async (targetId: string) => {
        if (!confirm("本当にこのデータとその対応履歴を、選択した顧客へ統合しますか？\n（現在開いている顧客データは削除されます。この操作は取り消せません）")) return;
        setIsMerging(true)
        try {
            const res = await fetch('/api/customers/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceId: customer.id, targetId })
            })
            if (!res.ok) throw new Error('Merge failed')
            onOpenChange(false)
            router.refresh()
            alert("顧客データの統合（マージ）が完了しました。")
        } catch (error) {
            console.error(error)
            alert("統合処理に失敗しました。")
        } finally {
            setIsMerging(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>顧客情報の確認・編集</DialogTitle>
                    <DialogDescription>
                        顧客の基本情報や連絡先、属性などを更新できます。
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="name">お名前 <span className="text-red-500">*</span></Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="kana">フリガナ</Label>
                            <Input id="kana" value={kana} onChange={(e) => setKana(e.target.value)} />
                        </div>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="email">メールアドレス</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <Label htmlFor="phone">電話番号</Label>
                        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <Label>顧客属性（所属会社等）</Label>
                        <Select value={customerType} onValueChange={setCustomerType}>
                            <SelectTrigger>
                                <SelectValue placeholder="属性を選択" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="協会会員">協会会員</SelectItem>
                                <SelectItem value="JapanRecord顧客">JapanRecord顧客</SelectItem>
                                <SelectItem value="未分類">未分類</SelectItem>
                                <SelectItem value="その他">その他</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col space-y-1.5 bg-green-50/50 p-3 rounded-md border border-green-100 mt-2">
                        <div className="flex justify-between items-center mb-1">
                            <Label htmlFor="lstepUrl" className="text-green-800 font-semibold">Lステップ連携 URL</Label>
                            {lstepUrl && (
                                <a href={lstepUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 flex items-center hover:underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1">
                                    管理画面を開く <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                            )}
                        </div>
                        <Input
                            id="lstepUrl"
                            placeholder="例: https://manager.linestep.net/line/detail/xxx"
                            value={lstepUrl}
                            onChange={(e) => setLstepUrl(e.target.value)}
                            className="bg-white placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex flex-col space-y-1.5 mt-2">
                        <Label htmlFor="notes">特記事項・メモ</Label>
                        <Textarea
                            id="notes"
                            placeholder="顧客に関する特別な引き継ぎ事項等"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[80px]"
                        />
                    </div>
                </div>

                {/* 統合提案セクション */}
                <div className="mt-2 border-t pt-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 text-slate-800">
                        <Merge className="h-4 w-4 text-blue-500" />
                        このデータを他の既存顧客と統合（マージ）する
                    </h4>
                    {isFetchingSuggestions ? (
                        <div className="flex items-center text-sm text-slate-500 gap-2 p-2">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> 類似する顧客を検索中...
                        </div>
                    ) : suggestions.length > 0 ? (
                        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                            <p className="text-xs text-slate-500 mb-2">名前（フリガナ）の類似性から、以下の顧客と同一人物である可能性があります。</p>
                            {suggestions.map(sug => (
                                <div key={sug.id} className="flex items-center justify-between p-3 bg-blue-50/60 border border-blue-100 rounded-md">
                                    <div>
                                        <div className="font-medium text-sm text-blue-900">{sug.name} 様 <span className="text-xs font-normal text-blue-600 ml-1">({sug.company || '会社不明'})</span></div>
                                        <div className="text-xs text-slate-500 mt-0.5">{sug.email ? sug.email : 'メール登録なし'} / {sug.phone ? sug.phone : '電話登録なし'} / {sug.customer_type || '属性不明'}</div>
                                    </div>
                                    <Button onClick={() => handleMerge(sug.id)} disabled={isMerging || loading} size="sm" variant="outline" className="text-xs bg-white text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0 ml-2">
                                        {isMerging ? "処理中..." : "この人と統合"}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded border text-center">
                            類似する名前の既存顧客は見つかりませんでした。
                        </p>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>キャンセル</Button>
                    <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                        {loading ? "更新中..." : "変更を保存"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
