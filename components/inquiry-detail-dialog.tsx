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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, MessageSquare } from "lucide-react"
import { format } from "date-fns"

export function InquiryDetailDialog({ inquiry, open, onOpenChange }: { inquiry: any, open: boolean, onOpenChange: (open: boolean) => void }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    // 編集可能な項目
    const [status, setStatus] = useState(inquiry?.status || "未対応")
    const [answer, setAnswer] = useState(inquiry?.answer || "")
    const [notes, setNotes] = useState(inquiry?.notes || "")

    // inquiryプロパティが変更されたときにステートを更新する
    useEffect(() => {
        if (inquiry) {
            setStatus(inquiry.status || "未対応")
            setAnswer(inquiry.answer || "")
            setNotes(inquiry.notes || "")
        }
    }, [inquiry])

    // ダイアログが開かれたときに初期値をセット
    if (!inquiry) return null;

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/inquiries/${inquiry.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, answer, notes }),
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <DialogTitle className="text-xl">対応内容の詳細</DialogTitle>
                            <DialogDescription>
                                {inquiry.received_at ? format(new Date(inquiry.received_at), 'yyyy年MM月dd日 HH:mm') : ''} の記録
                            </DialogDescription>
                        </div>
                        <Badge className={`mt-1 border-none shadow-none text-sm px-3 py-1 ${status === '対応中' ? 'bg-amber-100 text-amber-800' :
                            status === '未対応' ? 'bg-rose-100 text-rose-800' :
                                'bg-emerald-100 text-emerald-800'
                            }`}>
                            現在のステータス: {status}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                        <div>
                            <Label className="text-xs text-slate-500 mb-1 block">顧客名</Label>
                            <div className="font-medium">
                                {inquiry.customers?.name || '不明'} 様
                                {inquiry.original_sender && (
                                    <span className="text-xs text-slate-400 font-normal ml-2">
                                        (LINE名: {inquiry.original_sender})
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-slate-500 mb-1 block">会社 / チャネル</Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm">{inquiry.company}</span>
                                <Badge variant="outline" className="bg-white">
                                    {inquiry.channel === '電話' && <Phone className="mr-1 h-3 w-3" />}
                                    {inquiry.channel === 'Email' && <Mail className="mr-1 h-3 w-3" />}
                                    {inquiry.channel === 'LINE' && <MessageSquare className="mr-1 h-3 w-3" />}
                                    {inquiry.channel} ({inquiry.direction})
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Label className="font-medium text-slate-900 border-b pb-1 mb-2 block w-full">問い合わせ内容・架電内容</Label>
                            <div className="bg-white border rounded-md p-3 text-sm min-h-[80px] whitespace-pre-wrap">
                                {inquiry.content || '（内容なし）'}
                            </div>
                        </div>

                        <div className="grid gap-4 mt-4 border-t pt-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="status">ステータス変更</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className="w-48">
                                        <SelectValue placeholder="ステータス" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="未対応">未対応</SelectItem>
                                        <SelectItem value="対応中">対応中</SelectItem>
                                        <SelectItem value="完了">完了</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="answer">返答・対応結果</Label>
                                <Textarea
                                    id="answer"
                                    placeholder="お客様へどのように返答・対応したかを記録します"
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    className="min-h-[80px]"
                                />
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="notes">社内メモ・引き継ぎ事項</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="社内引き継ぎ用のメモ書き等"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="min-h-[60px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>閉じる</Button>
                    <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                        {loading ? "更新中..." : "変更を保存"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
