import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AGE_ORDER, countBy, customerKpis, fmtBaht, fmtNum, fmtPct, fmtThaiMonth, joinedByMonth, spendByAgeGroup,
} from './lib/metrics';

const BROWN = '#7c2d12';
const GENDER_COLORS = { หญิง: '#7c2d12', ชาย: '#d6a77a', ไม่ระบุ: '#a8a29e' };

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-bold sm:text-2xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

function Card({ title, note, children, className = '' }) {
  return (
    <section className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 ${className}`}>
      <h3 className="font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-stone-500">{note}</p>}
      <div className="mt-3 h-64">{children}</div>
    </section>
  );
}

const axis = { fontSize: 12 };
const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />;

export default function Customers({ customers, branches, sales }) {
  const m = useMemo(() => {
    const branchName = Object.fromEntries(branches.map((b) => [b.branch_id, b.branch]));
    return {
      kpi: customerKpis(customers, sales),
      gender: countBy(customers, 'gender'),
      age: countBy(customers, 'age_group', AGE_ORDER),
      branch: countBy(customers, 'home_branch_id').map((d) => ({ ...d, name: branchName[d.name] ?? d.name })),
      monthly: joinedByMonth(customers),
      spendAge: spendByAgeGroup(customers, sales),
      sharedPhone: customers.filter((c) => c.phone_shared === 'True').length,
    };
  }, [customers, branches, sales]);

  const { kpi } = m;
  const total = customers.length;

  return (
    <div className="mt-10 space-y-4">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">ลูกค้าสมาชิก</h2>
        <p className="mt-1 text-sm text-stone-500">
          จากข้อมูลลูกค้าที่ทำความสะอาดแล้ว (customers_clean.csv) เชื่อมกับยอดขายด้วย customer_id
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="สมาชิกทั้งหมด" value={`${fmtNum(kpi.members)} คน`} />
        <Kpi label="สมาชิกที่เคยซื้อ" value={`${fmtNum(kpi.buyers)} คน`} sub={`${fmtPct(kpi.buyerRate)} ของสมาชิก · ไม่เคยซื้อ ${fmtNum(kpi.neverBought)} คน`} />
        <Kpi label="ยอดซื้อเฉลี่ยต่อสมาชิก" value={fmtBaht(kpi.avgPerBuyer)} sub="เฉพาะสมาชิกที่เคยซื้อ" />
        <Kpi label="สัดส่วนยอดขายจากสมาชิก" value={fmtPct(kpi.memberShare)} sub="ที่เหลือคือลูกค้าทั่วไป" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="สัดส่วนเพศ" note="“ไม่ระบุ” คือลูกค้าที่ไม่ได้ตอบ ไม่ใช่ข้อมูลหาย">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={m.gender} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}
                label={({ x, y, textAnchor, name, count }) => (
                  <text x={x} y={y} textAnchor={textAnchor} fill="#44403c" fontSize={12}>{`${name} ${fmtPct(count / total)}`}</text>
                )}>
                {m.gender.map((d) => <Cell key={d.name} fill={GENDER_COLORS[d.name] ?? '#a8a29e'} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${fmtNum(v)} คน`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="สมาชิกตามกลุ่มอายุ">
          <ResponsiveContainer>
            <BarChart data={m.age} margin={{ left: 0, right: 8 }}>
              {grid}
              <XAxis dataKey="name" {...axis} />
              <YAxis tickFormatter={fmtNum} width={44} {...axis} />
              <Tooltip formatter={(v) => [`${fmtNum(v)} คน`, 'สมาชิก']} />
              <Bar dataKey="count" name="สมาชิก" fill={BROWN} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="สมาชิกแยกตามสาขาที่สมัคร" note="สาขาประจำ (home branch) ของสมาชิก เรียงมากไปน้อย">
          <ResponsiveContainer>
            <BarChart data={m.branch} margin={{ left: 0, right: 8 }}>
              {grid}
              <XAxis dataKey="name" {...axis} />
              <YAxis tickFormatter={fmtNum} width={44} {...axis} />
              <Tooltip formatter={(v) => [`${fmtNum(v)} คน`, 'สมาชิก']} />
              <Bar dataKey="count" name="สมาชิก" fill={BROWN} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="ยอดซื้อเฉลี่ยต่อสมาชิก แยกกลุ่มอายุ" note="เฉพาะสมาชิกที่เคยซื้อ ตลอดช่วงข้อมูล">
          <ResponsiveContainer>
            <BarChart data={m.spendAge} margin={{ left: 0, right: 8 }}>
              {grid}
              <XAxis dataKey="name" {...axis} />
              <YAxis tickFormatter={fmtNum} width={52} {...axis} />
              <Tooltip formatter={(v, n, p) => [`${fmtBaht(v)} (${fmtNum(p.payload.buyers)} คน)`, 'เฉลี่ยต่อสมาชิก']} />
              <Bar dataKey="avg" name="เฉลี่ยต่อสมาชิก" fill="#0f766e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="สมาชิกสมัครใหม่รายเดือน" note="แท่ง = สมัครใหม่ในเดือนนั้น · เส้น = จำนวนสะสม (ก.ย. 69 มีข้อมูลถึง 14 ก.ย. เท่านั้น)" className="[&>div]:h-72">
        <ResponsiveContainer>
          <ComposedChart data={m.monthly} margin={{ left: 0, right: 8 }}>
            {grid}
            <XAxis dataKey="month" tickFormatter={fmtThaiMonth} {...axis} minTickGap={16} />
            <YAxis yAxisId="l" tickFormatter={fmtNum} width={44} {...axis} />
            <YAxis yAxisId="r" orientation="right" tickFormatter={fmtNum} width={52} {...axis} />
            <Tooltip labelFormatter={fmtThaiMonth} formatter={(v, n) => [`${fmtNum(v)} คน`, n]} />
            <Legend />
            <Bar yAxisId="l" dataKey="count" name="สมัครใหม่" fill="#d6a77a" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="r" dataKey="cumulative" name="สะสม" stroke={BROWN} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <section className="rounded-xl bg-amber-50 p-4 text-sm text-stone-700 ring-1 ring-amber-200">
        <h3 className="font-semibold">ผลการตรวจคุณภาพข้อมูลลูกค้า (Data Profiling)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>ข้อมูล {fmtNum(total)} แถว ไม่มีค่าว่าง ไม่มีแถวซ้ำ รูปแบบและค่าอยู่ในชุดที่กำหนด ไม่มีใครสมัครก่อนสาขาเปิด</li>
          <li>มีเบอร์โทรซ้ำข้าม customer_id {fmtNum(m.sharedPhone)} แถว (ติดธงไว้ ไม่ลบ เพราะเบอร์ถูกปิดบังบางส่วน ยืนยันไม่ได้ว่าเป็นคนเดียวกัน)</li>
          <li>สมาชิก {fmtNum(kpi.neverBought)} คน ({fmtPct(1 - kpi.buyerRate)}) ไม่เคยซื้อเลย</li>
        </ul>
      </section>
    </div>
  );
}
