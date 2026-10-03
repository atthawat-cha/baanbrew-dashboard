import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  collection, doc, getDocs, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, where,
} from "firebase/firestore";

// Firebase web config อ่านจาก .env (VITE_*) ค่าเหล่านี้เป็น "ที่อยู่" ของโปรเจกต์ ไม่ใช่ความลับ
// ความปลอดภัยจริงอยู่ที่ Security Rules (firestore.rules) ส่วน service account key ห้ามอยู่ใน repo
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ---------- Auth (Lab 3.3) ----------
export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);
export const watchAuth = (cb) => onAuthStateChanged(auth, cb);

// ---------- ยอดขายรายวันที่สรุปไว้ (Lab 2: collection daily_sales) ----------
export async function fetchDailySales() {
  const snap = await getDocs(query(collection(db, "daily_sales"), orderBy("date")));
  return snap.docs.map((d) => d.data());
}

// ---------- ยอดขายรายรายการแบบ real-time (Lab 3.2: collection sales) ----------
// ฟังการเปลี่ยนแปลงตลอดเวลา (onSnapshot) กรองช่วงวันที่ที่ฝั่งเซิร์ฟเวอร์ (date เป็นข้อความ YYYY-MM-DD)
// คืนฟังก์ชัน unsubscribe ให้เรียกตอน cleanup ของ useEffect
export function subscribeSales(from, to, onRows, onError) {
  const q = query(collection(db, "sales"), where("date", ">=", from), where("date", "<=", to), orderBy("date"));
  return onSnapshot(q, (snap) => onRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

// บันทึกยอดขายใหม่ (ผ่านการตรวจของ Security Rules: ราคาต้องตรงกับเมนู, qty > 0, created_by = uid ฯลฯ)
export async function addSale({ branch, product, qty, uid }) {
  const th = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const part = (t) => th.find((p) => p.type === t).value;
  const orderId = `WEB-${Date.now().toString(36).toUpperCase()}`;
  const unit_price = Number(product.price);
  await setDoc(doc(db, "sales", `${orderId}-${product.product_id}`), {
    order_id: orderId,
    date: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number(part("hour")) % 24,
    branch,
    product_id: product.product_id,
    qty,
    unit_price,
    revenue: qty * unit_price,
    customer_id: null,
    source: "web",
    created_by: uid,
    created_at: serverTimestamp(),
  });
  return orderId;
}
