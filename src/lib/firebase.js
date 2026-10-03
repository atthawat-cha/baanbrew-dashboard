import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, orderBy, query } from "firebase/firestore";

// Firebase web config (ค่าเหล่านี้เป็นข้อมูลสาธารณะของ web app ความปลอดภัยอยู่ที่ Security Rules ของแต่ละบริการ)
const firebaseConfig = {
  apiKey: "AIzaSyAv2VHWMmZ6K0nrWGKiVAM6T1lvaEhHKg0",
  authDomain: "baanbrew.firebaseapp.com",
  projectId: "baanbrew",
  storageBucket: "baanbrew.firebasestorage.app",
  messagingSenderId: "312667805183",
  appId: "1:312667805183:web:bfc05ceb2005c75adf03ca",
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// ยอดขายรายวันที่สรุปไว้ใน Firestore (collection daily_sales, id = วันที่ YYYY-MM-DD)
export async function fetchDailySales() {
  const snap = await getDocs(query(collection(db, "daily_sales"), orderBy("date")));
  return snap.docs.map((d) => d.data());
}
