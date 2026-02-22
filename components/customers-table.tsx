"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CustomerDetailDialog } from "@/components/customer-detail-dialog"

export function CustomersTable({ customers }: { customers: any[] }) {
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const handleRowClick = (customer: any) => {
        setSelectedCustomer(customer)
        setIsDialogOpen(true)
    }

    return (
        <>
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow className="hover:bg-transparent">
                        <TableHead>お名前</TableHead>
                        <TableHead>フリガナ</TableHead>
                        <TableHead>メールアドレス</TableHead>
                        <TableHead>電話番号</TableHead>
                        <TableHead>属性</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {customers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                顧客データが登録されていません。
                            </TableCell>
                        </TableRow>
                    ) : (
                        customers.map((cus: any) => (
                            <TableRow
                                key={cus.id}
                                className="cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => handleRowClick(cus)}
                            >
                                <TableCell className="font-medium text-slate-900">{cus.name}</TableCell>
                                <TableCell className="text-slate-600">{cus.kana || '-'}</TableCell>
                                <TableCell className="text-slate-600">{cus.email || '-'}</TableCell>
                                <TableCell className="text-slate-600">{cus.phone || '-'}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">
                                        {cus.customer_type || '未分類'}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            <CustomerDetailDialog
                customer={selectedCustomer}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
            />
        </>
    )
}
