import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { addSale, subscribeSales } from './lib/firebase';
import {
  computeKpis, dailySales, fmtBaht, fmtHour, fmtNum, fmtThaiDate, ordersByHour, salesByBranch,
} from './lib/metrics';

const BRANCHES = ['สยาม', 'สีลม', 'อารีย์', 'บางนา', 'มหาวิทยาลัย'];
const DATA_FROM = '2026-06-21'; // ข้อมูลที่นำเข้าเริ่มวันนี้ (3 เดือนล่าสุด)
const BROWN = '#7c2d12';
const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />;
const axis = { fontSize: 12 };

// วันนี้ตามเวลาไทย (YYYY-MM-DD)
const todayTH = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date());

const box = 'rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200';
const field = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm';

function Kpi({ label, value }) {
  return (
    <div className={box}>
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-bold sm:text-2xl">{value}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className={box}>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="h-64">{children}</div>
    </section>
  );
}

// ฟอร์มบันทึกยอดขาย: ราคาใส่อัตโนมัติจากเมนู (Security Rules ตรวจว่าราคาต้องตรงกับ products)
function SaleForm({ user, products }) {
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [state, setState] = useState({ status: 'idle', msg: '' });

  const product = products.find((p) => p.product_id === productId);

  async function submit(e) {
    e.preventDefault();
    if (!product) return setState({ status: 'error', msg: 'กรุณาเลือกเมนู' });
    setState({ status: 'saving', msg: '' });
    try {
      const id = await addSale({ branch, product, qty: Number(qty), uid: user.uid });
      setState({ status: 'ok', msg: `บันทึกแล้ว (${id}) ยอด ${fmtBaht(Number(qty) * Number(product.price))}` });
      setQty(1);
    } catch (err) {
      setState({ status: 'error', msg: `บันทึกไม่สำเร็จ: ${err.code ?? err.message}` });
    }
  }

  return (
    <form onSubmit={submit} className={`${box} space-y-3`}>
      <h3 className="font-semibold">บันทึกยอดขาย</h3>
      <label className="block text-sm">
        <span className="text-stone-600">สาขา</span>
        <select className={field} value={branch} onChange={(e) => setBranch(e.target.value)}>
          {BRANCHES.map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-stone-600">เมนู</span>
        <select className={field} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">— เลือกเมนู —</option>
          {products.map((p) => (
            <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.price} ฿)</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-stone-600">จำนวน</span>
          <input className={field} type="number" min="1" max="20" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <div className="text-sm">
          <span className="text-stone-600">ราคา/ยอดรวม</span>
          <div className="mt-1 rounded-lg bg-stone-100 px-3 py-2 text-stone-700">
            {product ? `${product.price} ฿ → ${fmtBaht(Number(qty || 0) * Number(product.price))}` : '—'}
          </div>
        </div>
      </div>
      <button
        type="submit"
        disabled={state.status === 'saving' || !product || !(Number(qty) >= 1)}
        className="w-full rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {state.status === 'saving' ? 'กำลังบันทึก...' : 'บันทึกยอดขาย'}
      </button>
      {state.msg && (
        <p role="status" className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{state.msg}</p>
      )}
    </form>
  );
}

export default function Realtime({ user, products }) {
  const [from, setFrom] = useState(DATA_FROM);
  const [to, setTo] = useState(todayTH());
  const [branch, setBranch] = useState('ทั้งหมด');
  const [rows, setRows] = useState(null); // null = กำลังโหลด
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const validRange = from && to && from <= to;

  // ฟังข้อมูลแบบ real-time; เมื่อช่วงวันที่เปลี่ยนจะเลิกฟังอันเก่า (cleanup) แล้วฟังอันใหม่
  useEffect(() => {
    if (!validRange) return undefined;
    setRows(null);
    setError(null);
    const unsub = subscribeSales(
      from,
      to,
      (data) => { setRows(data); setUpdatedAt(new Date()); },
      (err) => setError(err),
    );
    return () => unsub();
  }, [from, to, validRange]);

  const shown = useMemo(() => rows && (branch === 'ทั้งหมด' ? rows : rows.filter((r) => r.branch === branch)), [rows, branch]);
  const kpi = useMemo(() => shown && computeKpis(shown), [shown]);
  const daily = useMemo(() => shown && dailySales(shown), [shown]);
  const byBranch = useMemo(() => shown && salesByBranch(shown), [shown]);
  const hourly = useMemo(() => shown && ordersByHour(shown).filter((d) => d.hour >= 7 && d.hour <= 20), [shown]);
  const recent = useMemo(
    () => (rows ?? []).filter((r) => r.source === 'web' && r.created_at).sort((a, b) => b.created_at.seconds - a.created_at.seconds).slice(0, 6),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className={`${box} flex flex-wrap items-end gap-3`}>
        <label className="text-sm">
          <span className="block text-stone-600">ตั้งแต่วันที่</span>
          <input className={field} type="date" value={from} min={DATA_FROM} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-stone-600">ถึงวันที่</span>
          <input className={field} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-stone-600">สาขา</span>
          <select className={field} value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option>ทั้งหมด</option>
            {BRANCHES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <p className="ml-auto flex items-center gap-2 text-xs text-stone-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          {updatedAt ? `อัปเดตสดล่าสุด ${updatedAt.toLocaleTimeString('th-TH')}` : 'กำลังเชื่อมต่อ...'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {!validRange ? (
            <p className={`${box} text-stone-600`}>ช่วงวันที่ไม่ถูกต้อง: วันเริ่มต้องไม่เกินวันสิ้นสุด</p>
          ) : error ? (
            <p role="alert" className={`${box} text-red-700`}>โหลดข้อมูลไม่สำเร็จ: {error.code ?? error.message}</p>
          ) : !rows ? (
            <p className={`${box} text-stone-500`}>กำลังโหลดข้อมูลจาก Firestore...</p>
          ) : shown.length === 0 ? (
            <p className={`${box} text-stone-600`}>ไม่มีข้อมูลยอดขายในช่วงที่เลือก ลองขยายช่วงวันที่หรือเปลี่ยนสาขา</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Kpi label="ยอดขายรวม" value={fmtBaht(kpi.revenue)} />
                <Kpi label="จำนวนบิล" value={fmtNum(kpi.orderCount)} />
                <Kpi label="ยอดเฉลี่ยต่อบิล" value={fmtBaht(kpi.avgPerOrder)} />
              </div>

              <Card title="ยอดขายรายวัน">
                <ResponsiveContainer>
                  <LineChart data={daily} margin={{ left: 0, right: 8 }}>
                    {grid}
                    <XAxis dataKey="date" tickFormatter={fmtThaiDate} minTickGap={32} {...axis} />
                    <YAxis tickFormatter={fmtNum} width={52} {...axis} />
                    <Tooltip labelFormatter={fmtThaiDate} formatter={(v) => [fmtBaht(v), 'ยอดขาย']} />
                    <Line dataKey="revenue" name="ยอดขาย" stroke={BROWN} strokeWidth={2} dot={daily.length < 15} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card title="ยอดขายแยกสาขา">
                  <ResponsiveContainer>
                    <BarChart data={byBranch} margin={{ left: 0, right: 8 }}>
                      {grid}
                      <XAxis dataKey="branch" {...axis} />
                      <YAxis tickFormatter={fmtNum} width={52} {...axis} />
                      <Tooltip formatter={(v) => [fmtBaht(v), 'ยอดขาย']} />
                      <Bar dataKey="revenue" name="ยอดขาย" fill={BROWN} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="จำนวนบิลตามชั่วโมง">
                  <ResponsiveContainer>
                    <BarChart data={hourly} margin={{ left: 0, right: 8 }}>
                      {grid}
                      <XAxis dataKey="hour" tickFormatter={fmtHour} {...axis} minTickGap={8} />
                      <YAxis tickFormatter={fmtNum} width={44} {...axis} />
                      <Tooltip labelFormatter={fmtHour} formatter={(v) => [`${fmtNum(v)} บิล`, 'จำนวนบิล']} />
                      <Bar dataKey="total" name="จำนวนบิล" fill="#0f766e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </>
          )}
        </div>

        <aside className="space-y-4">
          <SaleForm user={user} products={products} />
          <section className={box}>
            <h3 className="font-semibold">บันทึกจากเว็บล่าสุด</h3>
            {recent.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">ยังไม่มีรายการที่บันทึกจากหน้าเว็บในช่วงที่เลือก</p>
            ) : (
              <ul className="mt-2 divide-y divide-stone-100 text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 py-1.5">
                    <span>{r.branch} · {products.find((p) => p.product_id === r.product_id)?.product_name ?? r.product_id} ×{r.qty}</span>
                    <span className="font-medium">{fmtBaht(r.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
