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
    const d = r.date ?? r.datetime.slice(0, 10); // r.date มาจาก Firestore
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
    const h = r.hour ?? Number(r.datetime.slice(11, 13)); // r.hour มาจาก Firestore
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

// ===================== ลูกค้า (customers_clean.csv) =====================
export const AGE_ORDER = ['ต่ำกว่า 18', '18-24', '25-34', '35-44', '45-54', '55+'];

// นับจำนวนตามค่าของคอลัมน์ (เรียงตาม order ถ้าระบุ ไม่งั้นมาก -> น้อย)
export function countBy(rows, key, order) {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
  const out = [...m.entries()].map(([name, count]) => ({ name, count }));
  return order
    ? order.map((name) => ({ name, count: m.get(name) ?? 0 }))
    : out.sort((a, b) => b.count - a.count);
}

// สมาชิกสมัครใหม่รายเดือน + จำนวนสะสม
export function joinedByMonth(customers) {
  const m = new Map();
  for (const c of customers) {
    const k = c.joined_date.slice(0, 7);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  let total = 0;
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count, cumulative: (total += count) }));
}

// เชื่อมสมาชิกกับยอดขาย: ยอด/จำนวนบิลต่อ customer_id
function spendByCustomer(salesRows) {
  const m = new Map();
  for (const r of salesRows) {
    if (!r.customer_id) continue;
    const e = m.get(r.customer_id) ?? { revenue: 0, orders: new Set() };
    e.revenue += lineTotal(r);
    e.orders.add(r.order_id);
    m.set(r.customer_id, e);
  }
  return m;
}

// KPI ลูกค้า: สมาชิกทั้งหมด, สมาชิกที่เคยซื้อ, ยอดเฉลี่ยต่อสมาชิกที่ซื้อ, สัดส่วนยอดขายจากสมาชิก
export function customerKpis(customers, salesRows) {
  const spend = spendByCustomer(salesRows);
  const ids = new Set(customers.map((c) => c.customer_id));
  let memberRevenue = 0;
  let buyers = 0;
  for (const [id, e] of spend) if (ids.has(id)) { memberRevenue += e.revenue; buyers += 1; }
  const totalRevenue = salesRows.reduce((s, r) => s + lineTotal(r), 0);
  return {
    members: customers.length,
    buyers,
    buyerRate: customers.length ? buyers / customers.length : 0,
    avgPerBuyer: buyers ? memberRevenue / buyers : 0,
    memberShare: totalRevenue ? memberRevenue / totalRevenue : 0,
    neverBought: customers.length - buyers,
  };
}

// ยอดซื้อเฉลี่ยต่อสมาชิก (ที่เคยซื้อ) แยกกลุ่มอายุ
export function spendByAgeGroup(customers, salesRows) {
  const spend = spendByCustomer(salesRows);
  const agg = new Map(AGE_ORDER.map((a) => [a, { revenue: 0, buyers: 0 }]));
  for (const c of customers) {
    const e = spend.get(c.customer_id);
    if (!e) continue;
    const a = agg.get(c.age_group);
    a.revenue += e.revenue;
    a.buyers += 1;
  }
  return AGE_ORDER.map((name) => ({ name, avg: agg.get(name).buyers ? Math.round(agg.get(name).revenue / agg.get(name).buyers) : 0, buyers: agg.get(name).buyers }));
}

export const fmtPct = (x) => `${(x * 100).toFixed(1)}%`;
const TH_MONTHS_FULL = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
// '2025-04' -> 'เม.ย. 68'
export const fmtThaiMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${TH_MONTHS_FULL[m - 1]} ${String(y + 543).slice(-2)}`;
};
