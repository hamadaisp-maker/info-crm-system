const https = require('https');
const Papa = require('papaparse');

const SHEET_IDS = {
  ninchisho: '18dIpUuL2yxE0ttJAKTUNGA9KnuA844-CkvvX2D7dttE',
  japanrecord: '19Xtdl7GdEjD9SdCcy1EJyiw-YyaMr2HS9ihxvMg7yjA'
};

function fetchCsv(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, (redirRes) => {
          redirRes.on('data', chunk => data += chunk);
          redirRes.on('end', () => resolve(data));
          redirRes.on('error', reject);
        });
      } else {
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }
    });
  });
}

function displayHeaders(csvData, title) {
  Papa.parse(csvData, {
    complete: function(results) {
      console.log(`\n=== ${title} ===`);
      if (results.data.length > 0) {
        // Find the actual header row (some sheets have a title on row 1 and headers on row 2, or some empty rows)
        let headerRow = results.data.find(row => row.length > 3 && row.some(cell => cell.includes('お客様名') || cell.includes('氏名') || cell.includes('ユーザーID')));
        if (!headerRow) headerRow = results.data[0];
        console.log("Headers:");
        headerRow.forEach((col, idx) => console.log(`  [${idx}]: ${col}`));
      }
    }
  });
}

async function run() {
  const nin1 = await fetchCsv(SHEET_IDS.ninchisho, '受電報告書');
  displayHeaders(nin1, '認知症協会 - 受電報告書');
  
  const nin2 = await fetchCsv(SHEET_IDS.ninchisho, '架電・連絡事項');
  displayHeaders(nin2, '認知症協会 - 架電・連絡事項');
  
  const jr1 = await fetchCsv(SHEET_IDS.japanrecord, '受電報告書');
  displayHeaders(jr1, 'JapanRecord - 受電報告書');
  
  const jr2 = await fetchCsv(SHEET_IDS.japanrecord, '架電・連絡事項');
  displayHeaders(jr2, 'JapanRecord - 架電・連絡事項');
}

run();
