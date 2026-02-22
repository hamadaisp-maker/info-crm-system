"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"

export function NewRegistrationDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    // フォームステート
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        company: "日本認知症協会",
        channel: "電話",
        direction: "IN",
        content: "",
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // 実際はここでSupabaseへのInsert処理を行う（APIルート等経由）
            const res = await fetch('/api/inquiries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })

            if (!res.ok) throw new Error('Failed to submit')

            setOpen(false)
            router.refresh() // 画面を更新して最新データを取得

            // フォームリセット
            setFormData({
                name: "", phone: "", email: "",
                company: "日本認知症協会", channel: "電話",
                direction: "IN", content: ""
            })
        } catch (error) {
            console.error(error)
            alert("エラーが発生しました。")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" /> 新規登録
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>新規問い合わせ・顧客登録</DialogTitle>
                        <DialogDescription>
                            新しい問い合わせ内容、または顧客情報を登録します。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">

                        {/* 顧客情報セクション */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-sm text-slate-900 border-b pb-2">顧客情報（新規 または 検索）</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="name">お名前 <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="name"
                                        placeholder="例: 山田 太郎"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="phone">電話番号</Label>
                                    <Input
                                        id="phone"
                                        placeholder="例: 090-1234-5678"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="email">メールアドレス</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="例: taro@example.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* 対応情報セクション */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-sm text-slate-900 border-b pb-2">対応内容</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="flex flex-col space-y-1.5">
                                    <Label>対象会社</Label>
                                    <Select value={formData.company} onValueChange={(v) => setFormData({ ...formData, company: v })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="選択してください" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="日本認知症協会">日本認知症協会</SelectItem>
                                            <SelectItem value="JapanRecord">JapanRecord</SelectItem>
                                            <SelectItem value="共通・不明">共通・不明</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                    <Label>チャネル</Label>
                                    <Select value={formData.channel} onValueChange={(v) => setFormData({ ...formData, channel: v })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="選択してください" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="電話">電話</SelectItem>
                                            <SelectItem value="Email">Email</SelectItem>
                                            <SelectItem value="LINE">LINE</SelectItem>
                                            <SelectItem value="その他">その他</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                    <Label>IN/OUT</Label>
                                    <Select value={formData.direction} onValueChange={(v) => setFormData({ ...formData, direction: v })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="選択してください" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="IN">IN (受電/受信)</SelectItem>
                                            <SelectItem value="OUT">OUT (架電/送信)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="content">問い合わせ内容・対応メモ <span className="text-red-500">*</span></Label>
                                <Textarea
                                    id="content"
                                    className="min-h-[120px]"
                                    placeholder="対応した内容や、顧客からの問い合わせ詳細を記入してください..."
                                    required
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                />
                            </div>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                            {loading ? "保存中..." : "保存する"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
