import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { CartesianGrid, Legend, Line, LineChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeKpis, dailySales, salesByBranch, ordersByHour, fmtHour, fmtBaht, fmtNum, fmtThaiDate } from './lib/metrics';

const BRANCH_COLORS = ['#7c2d12', '#0f766e', '#7c3aed', '#ca8a04', '#be185d'];

const OBSERVATIONS = [
  'ทั้งเครือมีสองช่วงพีค: เที่ยง (12:00 ราว 3,700 บิล) และบ่าย–เย็นต้น (15:00–16:00 ราว 3,200 บิล) แล้วค่อย ๆ ลดลงจนปิดที่ 20:00 (ไม่มีบิลหลัง 21:00 และก่อน 07:00)',
  'สีลมและอารีย์พีคตอนเช้า (08:00) เช่น สีลม 1,243 บิล และมี 39% ของบิลสีลมเกิดในช่วง 07:00–09:00 ซึ่งสอดคล้องกับย่านออฟฟิศ/คนเดินทางไปทำงาน',
  'สยามและบางนาพีคตอนบ่าย (16:00) โดยบางนามีบิลหลัง 17:00 ถึง 32% ส่วนมหาวิทยาลัยพีคเที่ยง (12:00) ตามเวลาพักกลางวันของนักศึกษา จึงควรจัดพนักงานและโปรโมชันต่างกันตามสาขา',
];

function Kpi({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-bold sm:text-2xl">{value}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="h-72">{children}</div>
    </section>
  );
}

export default function App() {
  const [rows, setRows] = useState(null);
  const [byBranch, setByBranch] = useState(false);

  useEffect(() => {
    Papa.parse('/sales.csv', {
      download: true, header: true, skipEmptyLines: true, dynamicTyping: false,
      complete: (res) =>
        setRows(res.data.map((r) => ({ ...r, qty: Number(r.qty), unit_price: Number(r.unit_price) }))),
    });
  }, []);

  const kpis = useMemo(() => rows && computeKpis(rows), [rows]);
  const daily = useMemo(() => rows && dailySales(rows), [rows]);
  const branches = useMemo(() => rows && salesByBranch(rows), [rows]);
  const hourly = useMemo(() => rows && ordersByHour(rows).filter((d) => d.hour >= 7 && d.hour <= 20), [rows]);

  return (
    <main className="min-h-screen bg-stone-50 p-4 text-stone-900 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">บ้านบรู Dashboard</h1>
      {!rows ? (
        <p className="mt-6 text-stone-500">กำลังโหลดข้อมูล...</p>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="ยอดขายรวม" value={fmtBaht(kpis.revenue)} />
            <Kpi label="จำนวนบิล" value={fmtNum(kpis.orderCount)} />
            <Kpi label="ยอดเฉลี่ยต่อบิล" value={fmtBaht(kpis.avgPerOrder)} />
            <Kpi label="สมาชิก (ไม่ซ้ำ)" value={`${fmtNum(kpis.memberCount)} คน`} />
          </div>

          <Card title="ยอดขายรายวัน">
            <ResponsiveContainer>
              <LineChart data={daily} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="date" tickFormatter={fmtThaiDate} minTickGap={40} fontSize={12} />
                <YAxis tickFormatter={fmtNum} width={56} fontSize={12} />
                <Tooltip labelFormatter={fmtThaiDate} formatter={(v, n) => [fmtBaht(v), n]} />
                <Line isAnimationActive={false} name="รายวัน" dataKey="revenue" stroke="#d6a77a" strokeOpacity={0.45} dot={false} strokeWidth={1} />
                <Line isAnimationActive={false} name="เฉลี่ย 7 วัน" dataKey="ma7" stroke="#7c2d12" dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">จำนวนบิลตามชั่วโมงของวัน</h2>
              <div className="flex overflow-hidden rounded-lg text-sm ring-1 ring-stone-300">
                {[[false, 'รวม'], [true, 'แยกสาขา']].map(([v, label]) => (
                  <button key={label} onClick={() => setByBranch(v)}
                    className={`px-3 py-1 ${byBranch === v ? 'bg-stone-800 text-white' : 'bg-white text-stone-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer>
                {byBranch ? (
                  <LineChart data={hourly} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="hour" tickFormatter={fmtHour} fontSize={12} />
                    <YAxis tickFormatter={fmtNum} width={48} fontSize={12} />
                    <Tooltip labelFormatter={fmtHour} formatter={(v, n) => [`${fmtNum(v)} บิล`, n]} />
                    <Legend />
                    {branches.map((b, i) => (
                      <Line isAnimationActive={false} key={b.branch} name={b.branch} dataKey={b.branch} stroke={BRANCH_COLORS[i]} dot={false} strokeWidth={2} />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={hourly} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="hour" tickFormatter={fmtHour} fontSize={12} />
                    <YAxis tickFormatter={fmtNum} width={48} fontSize={12} />
                    <Tooltip labelFormatter={fmtHour} formatter={(v) => [`${fmtNum(v)} บิล`, 'จำนวนบิล']} />
                    <Bar isAnimationActive={false} name="จำนวนบิล" dataKey="total" fill="#7c2d12" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            <h3 className="mt-4 text-sm font-semibold">ข้อสังเกต</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-stone-700">
              {OBSERVATIONS.map((t) => <li key={t}>{t}</li>)}
            </ol>
          </section>

          <Card title="ยอดขายแยกสาขา">
            <ResponsiveContainer>
              <BarChart data={branches} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="branch" fontSize={12} />
                <YAxis tickFormatter={fmtNum} width={64} fontSize={12} />
                <Tooltip formatter={(v) => fmtBaht(v)} />
                <Bar isAnimationActive={false} name="ยอดขาย" dataKey="revenue" fill="#7c2d12" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </main>
  );
}
