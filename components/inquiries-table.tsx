"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Phone, Mail, MessageSquare } from "lucide-react"
import { format } from "date-fns"
import { InquiryDetailDialog } from "@/components/inquiry-detail-dialog"

export function InquiriesTable({ inquiries }: { inquiries: any[] }) {
    const [selectedInquiry, setSelectedInquiry] = useState<any>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const handleRowClick = (inquiry: any) => {
        setSelectedInquiry(inquiry)
        setIsDialogOpen(true)
    }

    return (
        <>
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[180px]">発生日時</TableHead>
                        <TableHead className="w-[120px]">チャネル</TableHead>
                        <TableHead className="w-[120px]">対象会社</TableHead>
                        <TableHead className="w-[200px]">顧客名</TableHead>
                        <TableHead>内容 / 件名</TableHead>
                        <TableHead className="w-[120px]">ステータス</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {inquiries.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                まだ対応履歴がありません。
                            </TableCell>
                        </TableRow>
                    ) : (
                        inquiries.map((inq: any) => (
                            <TableRow
                                key={inq.id}
                                className="cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => handleRowClick(inq)}
                            >
                                <TableCell className="font-medium text-slate-600">
                                    {inq.received_at ? format(new Date(inq.received_at), 'yyyy/MM/dd HH:mm') : '-'}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`border-none shadow-none ${inq.channel === '電話' ? 'bg-blue-50 text-blue-700' :
                                        inq.channel === 'Email' ? 'bg-emerald-50 text-emerald-700' :
                                            inq.channel === 'LINE' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                        {inq.channel === '電話' && <Phone className="mr-1 h-3 w-3" />}
                                        {inq.channel === 'Email' && <Mail className="mr-1 h-3 w-3" />}
                                        {inq.channel === 'LINE' && <MessageSquare className="mr-1 h-3 w-3" />}
                                        {inq.channel} ({inq.direction})
                                    </Badge>
                                </TableCell>
                                <TableCell><span className="text-sm text-slate-600">{inq.company}</span></TableCell>
                                <TableCell className="font-medium">
                                    <div>{inq.customers?.name || '不明な顧客'} 様</div>
                                    {inq.original_sender && (
                                        <div className="text-xs text-slate-400 font-normal mt-0.5">
                                            (LINE名: {inq.original_sender})
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="max-w-[300px]">
                                    <div className="font-medium text-slate-900 truncate">{inq.subject || '（件名なし）'}</div>
                                    <div className="text-sm text-slate-500 truncate">{inq.content}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge className={`border-none shadow-none ${inq.status === '対応中' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' :
                                        inq.status === '未対応' ? 'bg-rose-100 text-rose-800 hover:bg-rose-100' :
                                            'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                        }`}>
                                        {inq.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            <InquiryDetailDialog
                inquiry={selectedInquiry}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
            />
        </>
    )
}
