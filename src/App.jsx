import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { CartesianGrid, Legend, Line, LineChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Customers from './Customers';
import { fetchDailySales } from './lib/firebase';
import { computeKpis, dailySales, salesByBranch, ordersByHour, fmtHour, fmtBaht, fmtNum, fmtThaiDate } from './lib/metrics';

const BRANCH_COLORS = ['#7c2d12', '#0f766e', '#7c3aed', '#ca8a04', '#be185d'];

const OBSERVATIONS = [
  'ดูภาพรวมทุกสาขาแล้ว ลูกค้าเยอะสุดตอนเที่ยง (12:00 ประมาณ 3,700 บิล) แล้วมาพีคอีกรอบช่วงบ่าย 3–4 โมง (ประมาณ 3,200 บิล) หลังจากนั้นค่อย ๆ ลดลงจนถึง 20:00 และไม่มีบิลเลยก่อน 07:00 กับหลัง 21:00',
  'พอแยกสาขา สีลมกับอารีย์พีคตอนเช้า 08:00 ชัดมาก สีลมได้ 1,243 บิล และกว่า 39% ของบิลสีลมเกิดในช่วง 07:00–09:00 เดาว่าน่าจะเป็นลูกค้าที่แวะซื้อกาแฟก่อนเข้าทำงาน (ยังไม่ได้เช็กกับข้อมูลอื่น)',
  'สยามกับบางนาไปพีคตอนบ่าย (16:00) บางนามีบิลหลัง 17:00 ถึง 32% ส่วนมหาวิทยาลัยพีคตอนเที่ยง 12:00 เห็นได้ว่าแต่ละสาขาคนมาซื้อคนละเวลา ถ้าจะจัดคนหรือทำโปรโมชันก็น่าจะต้องแยกตามสาขา ไม่ใช่ใช้แบบเดียวกันทุกที่',
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
  const [customers, setCustomers] = useState(null);
  const [branchList, setBranchList] = useState(null);
  const [byBranch, setByBranch] = useState(false);
  const [fsDaily, setFsDaily] = useState(null); // ยอดรายวันจาก Firestore (ถ้าโหลดไม่ได้ใช้ค่าจาก CSV)

  useEffect(() => {
    Papa.parse('/sales.csv', {
      download: true, header: true, skipEmptyLines: true, dynamicTyping: false,
      complete: (res) =>
        setRows(res.data.map((r) => ({ ...r, qty: Number(r.qty), unit_price: Number(r.unit_price) }))),
    });
  }, []);

  useEffect(() => {
    const load = (url, set) =>
      Papa.parse(url, { download: true, header: true, skipEmptyLines: true, complete: (res) => set(res.data) });
    load('/customers_clean.csv', setCustomers);
    load('/branches.csv', setBranchList);
  }, []);

  useEffect(() => {
    fetchDailySales().then(setFsDaily).catch((e) => console.warn('Firestore ใช้ไม่ได้ ใช้ข้อมูลจาก CSV แทน', e));
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
              <LineChart data={fsDaily ?? daily} margin={{ left: 0, right: 8 }}>
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

          {customers && branchList && <Customers customers={customers} branches={branchList} sales={rows} />}
        </div>
      )}
    </main>
  );
}
