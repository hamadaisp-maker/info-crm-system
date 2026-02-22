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
import { Upload, CheckCircle2, FileJson } from "lucide-react"
import Papa from "papaparse"

export function CSVImportDialog({ customers }: { customers: any[] }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<1 | 2>(1) // 1:アップロード 2:完了
    const [loading, setLoading] = useState(false)

    const [sourceAccount, setSourceAccount] = useState("")
    const [historyFile, setHistoryFile] = useState<File | null>(null)
    const [mappingFile, setMappingFile] = useState<File | null>(null)

    // CSVをパースしてPromiseで返す共通関数
    const parseCSV = (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                if (!text) {
                    reject(new Error("File is empty"));
                    return;
                }
                Papa.parse(text, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        resolve(results.data);
                    },
                    error: (error: any) => {
                        reject(error);
                    }
                });
            };
            reader.onerror = () => reject(new Error("File read error"));
            reader.readAsText(file); // TODO: Shift_JIS対応などが必要な場合は調整
        });
    }

    const executeImport = async () => {
        if (!historyFile || !sourceAccount) {
            alert("必須項目（アカウント名・履歴CSV）を入力してください。");
            return;
        }

        setLoading(true);
        try {
            // 1. CSVファイルをパース
            const historyData = await parseCSV(historyFile);
            if (historyData.length === 0) {
                throw new Error("履歴CSVからデータを読み取れませんでした。");
            }

            let mappingData: any[] = [];
            if (mappingFile) {
                mappingData = await parseCSV(mappingFile);
            }

            const payload = {
                source_account: sourceAccount,
                history_data: historyData,
                mapping_data: mappingData
            };

            console.log("Importing Payload (Automated):", payload);

            // 2. 自動マージAPIへ送信
            const res = await fetch('/api/inquiries/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const resData = await res.json();
            if (!res.ok) {
                throw new Error(resData.error || 'Failed to import');
            }

            console.log("Import Result:", resData);

            // 3. 完了画面へ
            setStep(2);
            router.refresh();

        } catch (error: any) {
            console.error(error);
            alert("インポート中にエラーが発生しました。\n" + (error.message || ""));
        } finally {
            setLoading(false);
        }
    }

    const resetAndClose = () => {
        setOpen(false);
        setTimeout(() => {
            setStep(1);
            setHistoryFile(null);
            setMappingFile(null);
            setSourceAccount("");
        }, 300);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="bg-white hover:bg-slate-50 border-slate-200">
                    <Upload className="mr-2 h-4 w-4" /> 全自動インポート
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>LINE履歴の全自動インポート</DialogTitle>
                    <DialogDescription>
                        {step === 1 && "LINE公式アカウントのトーク履歴CSVと、名寄せリスト（任意）をアップロードして一括処理します。"}
                        {step === 2 && "インポートが完了しました"}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {/* STEP 1: ファイルアップロードと実行 */}
                    {step === 1 && (
                        <div className="grid gap-6">
                            <div className="flex flex-col space-y-1.5 p-4 bg-slate-50 rounded-lg border">
                                <Label htmlFor="sourceAccount" className="text-base font-semibold">流入元のLINEアカウント名 <span className="text-red-500">*</span></Label>
                                <p className="text-sm text-slate-500 mb-2">
                                    追加する履歴が記録されたLINE公式アカウントの名前を入力してください。<br />
                                    これにより、複数あるアカウントのどれから来たメッセージか判別できます。
                                </p>
                                <Input
                                    id="sourceAccount"
                                    placeholder="例: 日本認知症協会公式"
                                    value={sourceAccount}
                                    onChange={(e) => setSourceAccount(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col space-y-1.5 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                                <Label htmlFor="historyFile" className="text-base font-semibold text-emerald-800">1. LINE履歴CSV <span className="text-red-500">*</span></Label>
                                <p className="text-sm text-emerald-600 mb-2">
                                    LINE公式アカウントからエクスポートしたトーク履歴のCSVファイルを選択してください。
                                </p>
                                <Input
                                    id="historyFile"
                                    type="file"
                                    accept=".csv"
                                    className="bg-white"
                                    onChange={(e) => {
                                        if (e.target.files) setHistoryFile(e.target.files[0])
                                    }}
                                />
                            </div>

                            <div className="flex flex-col space-y-1.5 p-4 border rounded-lg bg-white">
                                <Label htmlFor="mappingFile" className="text-base font-semibold text-slate-700">2. 名寄せリストCSV <span className="font-normal text-slate-400 text-sm">（任意）</span></Label>
                                <p className="text-sm text-slate-500 mb-2">
                                    「LINE名」「本名」「LステップURL」が対応したリストがあればアップロードしてください。<br />
                                    可能な限りこのリストに基づいて自動で既存顧客との紐づけやアップデートを行います。
                                </p>
                                <Input
                                    id="mappingFile"
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => {
                                        if (e.target.files) setMappingFile(e.target.files[0])
                                    }}
                                />
                            </div>

                            <div className="bg-amber-50 rounded-md p-3 text-sm text-amber-800">
                                <strong>【自動処理の仕様】</strong><br />
                                アップロードを実行すると、システムが自動で全てのメッセージを取り込みます。名寄せリスト等で照合できなかった新しい「LINE名」が見つかった場合は、一旦独立した顧客データとして自動作成され履歴が保存されます（後日手動で既存顧客への統合・マージが可能です）。
                            </div>
                        </div>
                    )}

                    {/* STEP 2: 完了 */}
                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <div className="rounded-full bg-emerald-100 p-3">
                                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">自動インポートが完了しました！</h3>
                            <p className="text-center text-slate-500">
                                LINEアカウント「{sourceAccount}」の履歴がタイムラインに登録され、<br />
                                名寄せリストに該当しなかった新規ユーザーも自動作成されました。
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {step === 1 && (
                        <Button
                            onClick={executeImport}
                            disabled={!historyFile || !sourceAccount || loading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                        >
                            {loading ? "自動処理を実行中..." : "アップロードして全自動処理を開始"}
                        </Button>
                    )}
                    {step === 2 && (
                        <Button onClick={resetAndClose} className="bg-slate-900 hover:bg-slate-800 w-full sm:w-auto">
                            閉じる
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
