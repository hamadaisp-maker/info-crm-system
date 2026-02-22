import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { source_account, history_data, mapping_data } = body

        if (!history_data || history_data.length === 0 || !source_account) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const supabase = createClient()

        // 名前の比較用に全角半角スペースを削除して正規化するヘルパー
        const normalizeName = (name: string) => {
            if (!name) return "";
            return name.replace(/[\s\u3000]+/g, '');
        };

        // 1. 名寄せリスト（mapping_data）の構築
        // フォーマット例：LINE名, 本名, LステップURL
        const nameMapping = new Map<string, { realName: string; lstepUrl: string; rawLineName: string }>();
        if (mapping_data && mapping_data.length > 0) {
            for (const row of mapping_data) {
                const lineName = row["LINE名"] || row["LINEネーム"] || row["LINE"] || "";
                const realName = row["本名"] || row["名前"] || row["顧客名"] || "";
                const lstepUrl = row["LステップURL"] || row["Lステップ"] || row["URL"] || "";

                if (lineName) {
                    nameMapping.set(normalizeName(lineName), {
                        realName: realName.trim(), // DB保存用・検索用には元のフォーマット（単にtrim）を残しておく
                        lstepUrl: lstepUrl.trim(),
                        rawLineName: lineName.trim()
                    });
                }
            }
        }

        // 2. 履歴CSV（history_data）から、ユニークな送信者名を抽出
        const uniqueSenders = new Set<string>();
        for (const row of history_data) {
            const senderName = row["送信者"] || row["ユーザー名"] || row["ユーザー"] || row["名前"] || row["Sender"] || Object.values(row)[1] as string;
            if (senderName && senderName.trim() !== "") {
                uniqueSenders.add(senderName.trim());
            }
        }

        // DB検索対象の名前リスト（LINE名 そのもの + 名寄せリストにある本名）
        const searchNames = new Set<string>(uniqueSenders);
        for (const mapData of nameMapping.values()) {
            if (mapData.realName) {
                searchNames.add(mapData.realName);
            }
        }

        // 3. 既存顧客を一括検索
        const { data: existingCustomers, error: fetchError } = await supabase
            .from('customers')
            .select('id, name, notes')
            .in('name', Array.from(searchNames).slice(0, 1000));

        if (fetchError) {
            console.error("Fetch DB error:", fetchError);
            throw new Error("Failed to fetch existing customers.");
        }

        // DBの名前も正規化してマップを作っておく（揺れ吸収のため）
        const dbCustomerMap = new Map<string, string>(); // normalized_name -> id
        const dbCustomerNotesMap = new Map<string, string | null>(); // id -> notes
        existingCustomers?.forEach(c => {
            dbCustomerMap.set(normalizeName(c.name), c.id);
            dbCustomerNotesMap.set(c.id, c.notes);
        });

        // 送信者(LINE名)と最終的なCustomerIDの対応表
        const senderToCustomerId = new Map<string, string>();
        const newCustomersToInsert: any[] = [];
        const existingCustomersToUpdate: any[] = [];

        // 4. 各送信者に対してアクション（紐づけ or 新規作成）を決定
        for (const sender of Array.from(uniqueSenders)) {
            let matchedId = null;
            let finalLstepUrl = null;

            // 名寄せリストにあるか確認（先にLINE名で検索）
            const normalizedSender = normalizeName(sender);
            let mapData = nameMapping.get(normalizedSender);

            if (mapData) {
                finalLstepUrl = mapData.lstepUrl;
                // 本名が指定されており、それがDBに存在するか
                const normalizedRealName = normalizeName(mapData.realName);
                if (normalizedRealName && dbCustomerMap.has(normalizedRealName)) {
                    matchedId = dbCustomerMap.get(normalizedRealName);
                }
            }

            // 名寄せリストで明示的な本名指定による紐付けがなかった場合、送信者名（LINE名）そのもので既存DBを検索
            if (!matchedId && dbCustomerMap.has(normalizedSender)) {
                matchedId = dbCustomerMap.get(normalizedSender);
            }

            // それでも見つからず、もし名寄せリスト側に「本名」だけあってDBになければ、
            // 便宜上「本名」を名前にして新規作成した方が良いためsenderを上書きする
            let finalNameForInsert = sender;
            if (!matchedId && mapData && mapData.realName) {
                finalNameForInsert = mapData.realName;
            }

            // ---- 判定完了 ----
            if (matchedId) {
                senderToCustomerId.set(sender, matchedId);

                // 既存顧客のノート属性にLINEネームを追記する
                const currentNotes = dbCustomerNotesMap.get(matchedId) || "";
                const lineNameNote = `※連携LINE名: ${sender}`;
                let newNotes = undefined;

                if (!currentNotes.includes(lineNameNote)) {
                    newNotes = currentNotes ? `${currentNotes}\n${lineNameNote}` : lineNameNote;
                    dbCustomerNotesMap.set(matchedId, newNotes); // 同一ループ内で重複追加しないための更新
                }

                // LステップURLまたはノートに更新があるかチェック
                if (finalLstepUrl || newNotes !== undefined) {
                    const existingUpdate = existingCustomersToUpdate.find(u => u.id === matchedId);
                    if (existingUpdate) {
                        if (finalLstepUrl) existingUpdate.lstep_url = finalLstepUrl;
                        if (newNotes !== undefined) existingUpdate.notes = newNotes;
                    } else {
                        const updateData: any = { id: matchedId };
                        if (finalLstepUrl) updateData.lstep_url = finalLstepUrl;
                        if (newNotes !== undefined) updateData.notes = newNotes;
                        existingCustomersToUpdate.push(updateData);
                    }
                }
            } else {
                // 新規作成が必要なユーザーを配列にストック
                newCustomersToInsert.push({
                    name: finalNameForInsert,
                    customer_type: 'LINE自動インポート',
                    lstep_url: finalLstepUrl || null,
                    notes: `LINEアカウント「${source_account}」からのインポート時に自動作成されました。\n※元LINE名: ${sender}`
                });
            }
        }

        // 新規顧客を一括インサートし、発行されたIDを取得して対応表にセット
        if (newCustomersToInsert.length > 0) {
            const { data: insertedCustomers, error: insErr } = await supabase
                .from('customers')
                .insert(newCustomersToInsert)
                .select('id, name');

            if (insErr || !insertedCustomers) {
                console.error("Bulk insert new customers error:", insErr);
                throw new Error("Failed to insert new customers.");
            }

            insertedCustomers.forEach(cus => {
                senderToCustomerId.set(cus.name, cus.id);
            });
        }

        // (非同期で既存顧客の情報をアップデート)
        for (const updateData of existingCustomersToUpdate) {
            const updatePayload: any = {};
            if (updateData.lstep_url !== undefined) updatePayload.lstep_url = updateData.lstep_url;
            if (updateData.notes !== undefined) updatePayload.notes = updateData.notes;

            await supabase.from('customers').update(updatePayload).eq('id', updateData.id);
        }

        // 5. 問い合わせ（インクワイアリー）データの組み立て
        const inquiriesToInsert: any[] = [];
        for (const row of history_data) {
            const senderName = row["送信者"] || row["ユーザー名"] || row["ユーザー"] || row["名前"] || row["Sender"] || Object.values(row)[1] as string;
            const messageContent = row["メッセージ"] || row["内容"] || row["Message"] || row["本文"] || Object.values(row)[2] as string;
            const dateStr = row["日付"] || row["日時"] || row["Date"] || row["Time"] || Object.values(row)[0] as string;

            if (!senderName || !senderToCustomerId.has(senderName)) {
                continue;
            }

            const customerId = senderToCustomerId.get(senderName);

            inquiriesToInsert.push({
                customer_id: customerId,
                company: '不明',
                channel: 'LINE',
                direction: 'IN',
                status: '完了', // 過去ログのため完了扱い
                content: messageContent,
                received_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                source_account: source_account,
                original_sender: senderName
            });
        }

        // 6. 履歴を一括インサート
        if (inquiriesToInsert.length > 0) {
            const { error: batchInsertError } = await supabase
                .from('inquiries')
                .insert(inquiriesToInsert);

            if (batchInsertError) {
                console.error('Batch insert error:', batchInsertError);
                return NextResponse.json({ error: 'Failed to insert inquiries' }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            insertedCount: inquiriesToInsert.length
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
