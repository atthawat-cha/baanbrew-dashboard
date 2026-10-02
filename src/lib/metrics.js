// logic คำนวณทั้งหมดของ Dashboard (ไม่มี UI ในไฟล์นี้)

// ยอดขายต่อแถว = qty × unit_price
export const lineTotal = (r) => r.qty * r.unit_price;

// KPI รวม: ยอดขายรวม, จำนวนบิล, ยอดเฉลี่ยต่อบิล, สมาชิกไม่ซ้ำ
export function computeKpis(rows) {
  let revenue = 0;
  const orders = new Set(); // 1 บิลมีหลายแถว -> ใช้ Set นับ order_id ไม่ซ้ำ
  const members = new Set();
  for (const r of rows) {
    revenue += lineTotal(r);
    orders.add(r.order_id);
    if (r.customer_id) members.add(r.customer_id); // ว่าง = ลูกค้าทั่วไป ไม่นับ
  }
  const orderCount = orders.size;
  return {
    revenue,
    orderCount,
    avgPerOrder: orderCount ? revenue / orderCount : 0,
    memberCount: members.size,
  };
}

// ยอดขายรายวัน (วันที่ตามเวลาไทย = 10 ตัวอักษรแรกของ datetime ไม่แปลง timezone)
// พร้อมค่าเฉลี่ยเคลื่อนที่ 7 วัน (ใช้เท่าที่มีในช่วงต้น)
export function dailySales(rows) {
  const byDay = new Map();
  for (const r of rows) {
    const d = r.datetime.slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + lineTotal(r));
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  return days.map(([date, revenue], i) => {
    const win = days.slice(Math.max(0, i - 6), i + 1);
    const ma7 = win.reduce((s, [, v]) => s + v, 0) / win.length;
    return { date, revenue, ma7: Math.round(ma7) };
  });
}

// ยอดขายแยกสาขา เรียงมาก -> น้อย
export function salesByBranch(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.branch, (m.get(r.branch) ?? 0) + lineTotal(r));
  return [...m.entries()]
    .map(([branch, revenue]) => ({ branch, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

// การจัดรูปแบบ
export const fmtBaht = (n) => `฿${Math.round(n).toLocaleString('en-US')}`;
export const fmtNum = (n) => Math.round(n).toLocaleString('en-US');

const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
// '2025-04-01' -> '1 เม.ย. 68'
export function fmtThaiDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${String(y + 543).slice(-2)}`;
}

// จำนวนบิลตามชั่วโมงของวัน (เวลาไทย = ตัวอักษรที่ 12-13 ของ datetime)
// 1 บิลนับครั้งเดียว: ใช้ Set ของ order_id ต่อชั่วโมง/สาขา
// คืนค่า [{ hour, total, <ชื่อสาขา>: n, ... }] ครบ 24 ชั่วโมง
export function ordersByHour(rows) {
  const total = Array.from({ length: 24 }, () => new Set());
  const perBranch = new Map(); // branch -> 24 Sets
  for (const r of rows) {
    const h = Number(r.datetime.slice(11, 13));
    total[h].add(r.order_id);
    if (!perBranch.has(r.branch)) perBranch.set(r.branch, Array.from({ length: 24 }, () => new Set()));
    perBranch.get(r.branch)[h].add(r.order_id);
  }
  return total.map((s, h) => {
    const row = { hour: h, total: s.size };
    for (const [b, sets] of perBranch) row[b] = sets[h].size;
    return row;
  });
}

export const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`;
