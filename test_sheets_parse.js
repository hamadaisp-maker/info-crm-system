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
  const parseAndPrint = (csv, name) => {
    const lines = csv.split('\\n').filter(l => l.trim());
    console.log(`\n=== ${name} ===`);
    if (lines.length > 0) console.log("Header:", lines[0]);
    if (lines.length > 1) console.log("Row 1:", lines[1]);
  };

  try {
    const nin1 = await fetchSheetCsv(SHEET_IDS.ninchisho, '受電報告書');
    parseAndPrint(nin1, '認知症協会 - 受電報告書');
    
    const nin2 = await fetchSheetCsv(SHEET_IDS.ninchisho, '架電・連絡事項');
    parseAndPrint(nin2, '認知症協会 - 架電・連絡事項');

    const jr1 = await fetchSheetCsv(SHEET_IDS.japanrecord, '受電報告書');
    parseAndPrint(jr1, 'JapanRecord - 受電報告書');
    
    const jr2 = await fetchSheetCsv(SHEET_IDS.japanrecord, '架電・連絡事項');
    parseAndPrint(jr2, 'JapanRecord - 架電・連絡事項');
  } catch (err) {
    console.error(err);
  }
}

run();
