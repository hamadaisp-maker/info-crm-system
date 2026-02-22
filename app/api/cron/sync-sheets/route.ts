import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase'
import * as Papa from 'papaparse'

const API_SECRET = process.env.CRON_SECRET || 'sync-secret'

const SHEETS = [
    {
        name: '認知症協会_受電報告書',
        url: 'https://docs.google.com/spreadsheets/d/18dIpUuL2yxE0ttJAKTUNGA9KnuA844-CkvvX2D7dttE/gviz/tq?tqx=out:csv&sheet=%E5%8F%97%E9%9B%BB%E5%A0%B1%E5%91%8A%E6%9B%B8',
        company: '日本認知症協会'
    },
    {
        name: '認知症協会_架電連絡事項',
        url: 'https://docs.google.com/spreadsheets/d/18dIpUuL2yxE0ttJAKTUNGA9KnuA844-CkvvX2D7dttE/gviz/tq?tqx=out:csv&sheet=%E6%9E%B6%E9%9B%BB%E3%83%BB%E9%80%A3%E7%B5%A1%E4%BA%8B%E9%A0%85',
        company: '日本認知症協会'
    },
    {
        name: 'JapanRecord_受電報告書',
        url: 'https://docs.google.com/spreadsheets/d/19Xtdl7GdEjD9SdCcy1EJyiw-YyaMr2HS9ihxvMg7yjA/gviz/tq?tqx=out:csv&sheet=%E5%8F%97%E9%9B%BB%E5%A0%B1%E5%91%8A%E6%9B%B8',
        company: 'JapanRecord'
    },
    {
        name: 'JapanRecord_架電連絡事項',
        url: 'https://docs.google.com/spreadsheets/d/19Xtdl7GdEjD9SdCcy1EJyiw-YyaMr2HS9ihxvMg7yjA/gviz/tq?tqx=out:csv&sheet=%E6%9E%B6%E9%9B%BB%E3%83%BB%E9%80%A3%E7%B5%A1%E4%BA%8B%E9%A0%85',
        company: 'JapanRecord'
    }
]

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${API_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createClient()
        let totalImported = 0
        let totalUpdated = 0

        for (const sheet of SHEETS) {
            console.log(`Fetching ${sheet.name}...`)
            const res = await fetch(sheet.url)
            const csvText = await res.text()

            const parsed = Papa.parse(csvText, { skipEmptyLines: true })
            const rows = parsed.data as string[][]
            if (rows.length < 2) continue

            // Find header row index
            let headerIdx = rows.findIndex(r => r.some(c => typeof c === 'string' && (c.includes('お客様名') || c.includes('氏名'))))
            if (headerIdx === -1) headerIdx = 0

            const headers = rows[headerIdx]

            // Map column names to indexes
            const colMap: Record<string, number> = {}
            headers.forEach((h, i) => { if (typeof h === 'string') colMap[h.trim()] = i })

            // Keys we usually expect:
            const nameIdx = colMap['お客様名'] ?? colMap['氏名'] ?? -1
            const phoneIdx = colMap['TEL'] ?? colMap['電話番号'] ?? -1
            const dateIdx = colMap['受付日'] ?? colMap['日付'] ?? -1
            const timeIdx = colMap['時間'] ?? -1
            const contentIdx = Object.keys(colMap).find(k => k.includes('内容')) ? colMap[Object.keys(colMap).find(k => k.includes('内容'))!] : -1
            const staffIdx = colMap['担当'] ?? -1

            // Variables for later appends
            const isKToM = sheet.name.includes('認知症協会_架電連絡事項')
            const isLToN = sheet.name.includes('JapanRecord_架電連絡事項')

            if (nameIdx === -1 || contentIdx === -1) {
                console.warn(`Skipping ${sheet.name}: Missing essential columns.`)
                continue
            }

            // Parse recent rows (e.g. last 100 rows to avoid checking entire history)
            const dataRows = rows.slice(headerIdx + 1).slice(-100)

            for (const row of dataRows) {
                const name = row[nameIdx]
                if (!name) continue

                const phone = phoneIdx !== -1 ? row[phoneIdx] : ''
                const date = dateIdx !== -1 ? row[dateIdx] : ''
                const time = timeIdx !== -1 ? row[timeIdx] : ''
                const content = row[contentIdx]
                const staff = staffIdx !== -1 ? row[staffIdx] : ''

                // Compute extra tracking notes for 架電連絡事項
                let extraNotes = ""
                if (isKToM) {
                    // K-M is index 10-12
                    const k = row[10] || ''
                    const l = row[11] || ''
                    const m = row[12] || ''
                    if (k || l || m) extraNotes = `\\n\\n【追記対応】\\n${k}\\n${l}\\n${m}`.trim()
                } else if (isLToN) {
                    // L-N is index 11-13
                    const l = row[11] || ''
                    const m = row[12] || ''
                    const n = row[13] || ''
                    if (l || m || n) extraNotes = `\\n\\n【追記対応】\\n${l}\\n${m}\\n${n}`.trim()
                }

                const finalContent = `${content}${extraNotes}`

                // We use a combination of sheetname + date + name + phone to trace duplicates
                // Since there is no unique ID, we store this mapping in `source_account` or similar, or just check content combination
                let receivedAt = new Date().toISOString()
                if (date) {
                    try {
                        // Assuming JP locale date string yyyy/mm/dd
                        const dateTimeStr = time ? `${date} ${time}` : `${date} 12:00`
                        receivedAt = new Date(dateTimeStr).toISOString()
                    } catch (e) { /* ignore parse error */ }
                }

                // Check customer
                let customerId = null
                const { data: existingCust } = await supabase.from('customers').select('id').eq('name', name).limit(1)
                if (existingCust && existingCust.length > 0) {
                    customerId = existingCust[0].id
                } else {
                    const { data: newCust, error: custErr } = await supabase.from('customers').insert([{
                        name, phone: phone || null, company: sheet.company
                    }]).select().single()
                    if (newCust && !custErr) customerId = newCust.id
                }

                if (!customerId) continue

                // Check inquiry using exact timestamp and customer ID, or recent time
                // To be safe, we check if an inquiry with the same customer & channel ('電話') exists within 2 days with similar content
                const { data: existingInq } = await supabase.from('inquiries')
                    .select('id, content')
                    .eq('customer_id', customerId)
                    .eq('channel', '電話')
                    .order('received_at', { ascending: false })
                    .limit(5)

                let foundMatch = null
                if (existingInq) {
                    for (const inq of existingInq) {
                        if (inq.content.startsWith(content.substring(0, 30))) {
                            foundMatch = inq
                            break
                        }
                    }
                }

                if (foundMatch) {
                    // Check if extraNotes implies we should update
                    if (finalContent !== foundMatch.content) {
                        await supabase.from('inquiries').update({ content: finalContent, status: '対応済' }).eq('id', foundMatch.id)
                        totalUpdated++
                    }
                } else {
                    // Insert new
                    await supabase.from('inquiries').insert([{
                        customer_id: customerId,
                        company: sheet.company,
                        channel: '電話',
                        direction: 'IN', // Defaulting to IN, but this could vary
                        content: finalContent,
                        status: extraNotes ? '対応済' : '対応中',
                        source_account: staff ? `担当: ${staff}` : null,
                        received_at: receivedAt
                    }])
                    totalImported++
                }
            }
        }

        return NextResponse.json({ success: true, imported: totalImported, updated: totalUpdated })

    } catch (error) {
        console.error('Cron Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
