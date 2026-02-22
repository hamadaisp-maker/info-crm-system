const fs = require('fs');
const https = require('https');

const SHEET_IDS = {
    ninchisho: '18dIpUuL2yxE0ttJAKTUNGA9KnuA844-CkvvX2D7dttE',
    japanrecord: '19Xtdl7GdEjD9SdCcy1EJyiw-YyaMr2HS9ihxvMg7yjA'
};

async function fetchSheetCsv(sheetId, sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Handle redirect
                https.get(res.headers.location, (redirectRes) => {
                    redirectRes.on('data', chunk => data += chunk);
                    redirectRes.on('end', () => resolve(data));
                    redirectRes.on('error', reject);
                }).on('error', reject);
            } else {
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
                res.on('error', reject);
            }
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log("=== 認知症協会 シート一覧テスト ===");
        console.log("1. 受電報告書");
        const nin1 = await fetchSheetCsv(SHEET_IDS.ninchisho, '受電報告書');
        console.log(nin1.split('\\n').slice(0, 5).join('\\n'));

        console.log("\\n2. 架電・連絡事項");
        const nin2 = await fetchSheetCsv(SHEET_IDS.ninchisho, '架電・連絡事項');
        console.log(nin2.split('\\n').slice(0, 5).join('\\n'));

        console.log("\\n=== JapanRecord シート一覧テスト ===");
        console.log("1. 受電報告書");
        const jr1 = await fetchSheetCsv(SHEET_IDS.japanrecord, '受電報告書');
        console.log(jr1.split('\\n').slice(0, 5).join('\\n'));

        console.log("\\n2. 架電・連絡事項");
        const jr2 = await fetchSheetCsv(SHEET_IDS.japanrecord, '架電・連絡事項');
        console.log(jr2.split('\\n').slice(0, 5).join('\\n'));

    } catch (err) {
        console.error(err);
    }
}

run();
