// Lab 3.1: นำเข้า sales 3 เดือนล่าสุด (21 มิ.ย. – 20 ก.ย. 2026) ลง Firestore collection "sales"
//
// ไม่ใช้ service account key: ใช้บัญชีที่ล็อกอินไว้กับ firebase-tools (firebase login) เรียก Firestore REST API
// จึงไม่มีไฟล์ key ที่ต้องกลัวหลุดขึ้น GitHub
//
// รัน: node scripts/seed-sales.mjs <path ของโฟลเดอร์ firebase-tools>
//   เช่น node scripts/seed-sales.mjs "C:/Users/<ชื่อ>/AppData/Local/npm-cache/_npx/<hash>/node_modules/firebase-tools"
//
// - document id = order_id + "-" + product_id  -> รันซ้ำได้ ไม่เกิดข้อมูลซ้ำ (เขียนทับเอกสารเดิม)
// - เพิ่ม field date, hour, revenue
// - เขียนเป็น batch ครั้งละไม่เกิน 500
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import Papa from 'papaparse';

const FROM_DATE = '2026-06-21';
const PROJECT = 'baanbrew';
const BATCH = 500;

const require = createRequire(import.meta.url);
const ft = process.argv[2];
if (!ft) throw new Error('ต้องระบุ path ของ firebase-tools เป็นอาร์กิวเมนต์แรก');
const auth = require(path.join(ft, 'lib/auth.js'));
const store = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
const { access_token } = await auth.getAccessToken(store.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);

const rows = Papa.parse(fs.readFileSync('public/sales.csv', 'utf8'), { header: true, skipEmptyLines: true }).data;

const docs = rows
  .map((r) => {
    const qty = Number(r.qty);
    const unit_price = Number(r.unit_price);
    return {
      order_id: r.order_id,
      date: r.datetime.slice(0, 10), // วันที่ตามเวลาไทย ไม่แปลง timezone
      hour: Number(r.datetime.slice(11, 13)),
      branch: r.branch,
      product_id: r.product_id,
      qty,
      unit_price,
      revenue: qty * unit_price,
      customer_id: r.customer_id || null,
      source: 'import',
    };
  })
  .filter((d) => d.date >= FROM_DATE);

const val = (v) =>
  v === null ? { nullValue: null } : typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v };
const DB = `projects/${PROJECT}/databases/(default)/documents`;
const writes = docs.map((d) => ({
  update: { name: `${DB}/sales/${d.order_id}-${d.product_id}`, fields: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, val(v)])) },
}));

let done = 0;
for (let i = 0; i < writes.length; i += BATCH) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: writes.slice(i, i + BATCH) }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  done += Math.min(BATCH, writes.length - i);
}
console.log(`นำเข้า ${done} เอกสาร (${FROM_DATE} ถึง ${docs.map((d) => d.date).sort().at(-1)}) ลง collection "sales"`);
