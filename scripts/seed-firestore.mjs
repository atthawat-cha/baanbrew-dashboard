// อัปโหลดข้อมูลสรุปลง Firestore (รันครั้งเดียว) ใช้บัญชีที่ล็อกอินไว้กับ firebase-tools
// รัน: node scripts/seed-firestore.mjs <path ของ firebase-tools>
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import Papa from 'papaparse';
import { dailySales } from '../src/lib/metrics.js';

const require = createRequire(import.meta.url);
const ft = process.argv[2];
const auth = require(path.join(ft, 'lib/auth.js'));
const store = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
const { access_token } = await auth.getAccessToken(store.tokens.refresh_token, [
  'https://www.googleapis.com/auth/cloud-platform',
]);

const PROJECT = 'baanbrew';
const DB = `projects/${PROJECT}/databases/(default)/documents`;
const read = (f) => Papa.parse(fs.readFileSync(`public/${f}.csv`, 'utf8'), { header: true, skipEmptyLines: true, dynamicTyping: true }).data;

const val = (v) =>
  v === null || v === undefined || v === '' ? { nullValue: null }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : { stringValue: String(v) };
const doc = (col, id, obj) => ({
  update: { name: `${DB}/${col}/${id}`, fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, val(v)])) },
});

const sales = Papa.parse(fs.readFileSync('public/sales.csv', 'utf8'), { header: true, skipEmptyLines: true }).data
  .map((r) => ({ ...r, qty: Number(r.qty), unit_price: Number(r.unit_price) }));

const writes = [
  ...read('branches').map((b) => doc('branches', b.branch_id, { ...b, opened_date: String(b.opened_date).slice(0, 10) })),
  ...read('products').map((p) => doc('products', p.product_id, { ...p, launched_date: String(p.launched_date).slice(0, 10) })),
  ...dailySales(sales).map((d) => doc('daily_sales', d.date, d)),
];

for (let i = 0; i < writes.length; i += 400) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${DB.replace('/documents', '')}/documents:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: writes.slice(i, i + 400) }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}
console.log('wrote', writes.length, 'documents');
