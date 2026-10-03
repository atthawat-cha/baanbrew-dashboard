// ทดสอบ Firestore Security Rules ด้วย firebaserules API (ไม่ต้องใช้ emulator)
// รัน: node scripts/test-rules.mjs <path ของ firebase-tools>
import fs from 'fs'; import os from 'os'; import path from 'path'; import { createRequire } from 'module';
const require=createRequire(import.meta.url); const ft=process.argv[2];
const auth=require(path.join(ft,'lib/auth.js'));
const store=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/configstore/firebase-tools.json'),'utf8'));
const {access_token}=await auth.getAccessToken(store.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const source=fs.readFileSync('firestore.rules','utf8');
const P='/databases/(default)/documents';
const good={order_id:'WEB-1',date:'2026-10-03',hour:10,branch:'สยาม',product_id:'P001',qty:2,unit_price:55,revenue:110,customer_id:null,source:'web',created_by:'u1',created_at:'REQTIME'};
const user={uid:'u1',token:{}};
const mock=[{function:'get',args:[{exact_value:`${P}/products/P001`}],result:{value:{data:{price:55}}}}];
const T=(name,expect,path_,method,data,u=user)=>({name,expect,tc:{expectation:expect,request:{path:`${P}${path_}`,method,...(data?{resource:{data}}:{}),...(u?{auth:u}:{})},functionMocks:mock}});
const cases=[
 T('ไม่ล็อกอินอ่าน sales','DENY','/sales/x','get',null,null),
 T('ล็อกอินอ่าน sales','ALLOW','/sales/x','get'),
 T('ไม่ล็อกอินเขียน sales','DENY','/sales/WEB-1-P001','create',good,null),
 T('เขียนถูกต้อง','ALLOW','/sales/WEB-1-P001','create',good),
 T('qty = -5','DENY','/sales/WEB-1-P001','create',{...good,qty:-5,revenue:-275}),
 T('qty = 0','DENY','/sales/WEB-1-P001','create',{...good,qty:0,revenue:0}),
 T('qty = 999','DENY','/sales/WEB-1-P001','create',{...good,qty:999,revenue:54945}),
 T('revenue ไม่ตรง','DENY','/sales/WEB-1-P001','create',{...good,revenue:1}),
 T('แก้ราคาเอง (unit_price=1)','DENY','/sales/WEB-1-P001','create',{...good,unit_price:1,revenue:2}),
 T('สาขาแปลก','DENY','/sales/WEB-1-P001','create',{...good,branch:'ลับ'}),
 T('hour = 99','DENY','/sales/WEB-1-P001','create',{...good,hour:99}),
 T('วันที่ผิดรูปแบบ','DENY','/sales/WEB-1-P001','create',{...good,date:'วันนี้'}),
 T('แอบใส่ field เกิน','DENY','/sales/WEB-1-P001','create',{...good,admin:true}),
 T('ปลอม created_by คนอื่น','DENY','/sales/WEB-1-P001','create',{...good,created_by:'someone-else'}),
 T('source ไม่ใช่ web','DENY','/sales/WEB-1-P001','create',{...good,source:'import'}),
 T('document id ไม่ตรง order-product','DENY','/sales/hacked','create',good),
 T('แก้ไข (update)','DENY','/sales/WEB-1-P001','update',good),
 T('ลบ (delete)','DENY','/sales/WEB-1-P001','delete'),
 T('สาธารณะอ่าน daily_sales','ALLOW','/daily_sales/2026-09-20','get',null,null),
 T('สาธารณะเขียน daily_sales','DENY','/daily_sales/x','create',{a:1},null),
 T('คอลเลกชันอื่นที่ไม่มีกฎ','DENY','/secrets/x','get',null,null),
];
// created_at ต้องเท่ากับ request.time: ส่งเป็นเวลาเดียวกับ request ในเคสทดสอบ
const now=new Date().toISOString();
for(const c of cases){ const r=c.tc.request; if(r.resource?.data?.created_at==='REQTIME'){ r.resource.data.created_at=now; r.time=now; } else if(r.resource) r.time=now; if(r.resource&&r.resource.data.created_at==='REQTIME') {} }
const res=await fetch('https://firebaserules.googleapis.com/v1/projects/baanbrew:test',{method:'POST',headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json'},body:JSON.stringify({source:{files:[{name:'firestore.rules',content:source}]},testSuite:{testCases:cases.map(c=>c.tc)}})});
const j=await res.json();
if(j.error){console.log(JSON.stringify(j.error));process.exit(1)}
if(j.issues) console.log('ISSUES',JSON.stringify(j.issues));
const results=j.testResults??[];
let bad=0; results.forEach((r,i)=>{const ok=r.state==='SUCCESS'; if(!ok)bad++; console.log(ok?'✅':'❌',cases[i].expect.padEnd(5),cases[i].name, ok?'':JSON.stringify(r.debugMessages?.slice(0,2)??r.errorPosition??''))});
console.log(bad?`พลาด ${bad} ข้อ`:'ผ่านทั้งหมด',results.length);
