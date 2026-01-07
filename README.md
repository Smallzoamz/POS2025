# 🍽️ POS-2025: Tasty Station Management System

[![Framework](https://img.shields.io/badge/Framework-React_18-61DAFB?logo=react)](https://reactjs.org/)
[![Runtime](https://img.shields.io/badge/Runtime-Electron-47848F?logo=electron)](https://www.electronjs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql)](https://www.postgresql.org/)
[![Realtime](https://img.shields.io/badge/Realtime-Socket.io-010101?logo=socket.io)](https://socket.io/)

[ภาษาไทย](#-ภาษาไทย) | [English](#-english)

---

## 🇹🇭 ภาษาไทย

**POS-2025** คือระบบจัดการหน้าร้าน (POS) และระบบบริหารจัดการร้านอาหารที่เน้นประสิทธิภาพและความสวยงาม พัฒนาด้วยเทคโนโลยี **React**, **Electron**, และ **PostgreSQL** เพื่อมอบประสบการณ์การทำงานที่ลื่นไหลและเสถียรที่สุด

### ✨ คุณสมบัติเด่น
- **จัดการผังโต๊ะอัจฉริยะ:** ดูสถานะโต๊ะและออเดอร์แบบเรียลไทม์ผ่านมุมมองตาราง (Grid View)
- **ระบบสั่งอาหาร Omni-channel:** รวมศูนย์ออเดอร์จากทั้งหน้าเคาน์เตอร์, รับกลับบ้าน และ **การสั่งผ่าน LINE**
- **ห้องครัวดิจิทัล (KDS):** ตัดปัญหาออเดอร์ตกหล่นด้วยระบบแจ้งเตือนเข้าห้องครัวและบาร์น้ำทันที
- **ระบบตัดสต็อกอัตโนมัติ:** คำนวณการใช้วัตถุดิบจริงตามสูตรอาหารและตัวเลือกเสริมอย่างแม่นยำ
- **ชำระเงินด้วย PromptPay:** สร้าง QR Code พร้อมยอดเงินที่ถูกต้องโดยอัตโนมัติ ช่วยลดความผิดพลาดด้านบัญชี
- **วิเคราะห์ยอดขายเชิงลึก:** Dashboard สรุปรายได้, สินค้าขายดี และแนวโน้มการเติบโตของร้าน

---

## 🇺🇸 English

**POS-2025** is a premium, high-performance Point of Sale (POS) and Store Management system designed for modern restaurants and cafes. Built with **React**, **Electron**, and **PostgreSQL**, it offers a seamless blend of local reliability and cloud-ready features.

### ✨ Key Features
- **Interactive Management:** Manage active tables, orders, and statuses in real-time.
- **Omni-channel Ordering:** Centralized system for In-store, Takeaway, and **LINE Integration**.
- **Kitchen Display System (KDS):** Instant synchronization between front and back of house.
- **Smart Stock Deduction:** Automatic inventory reduction based on recipes and order options.
- **PromptPay Integration:** Auto-generate dynamic QR codes for instant, error-free payments.
- **Dashboard & Analytics:** Real-time monitoring of revenue, best-sellers, and sales trends.

---

## 🛠️ Technology Stack (เทคโนโลยีที่ใช้)

- **Frontend:** React 18, Tailwind CSS, Recharts
- **Backend:** Node.js (Express), Electron
- **Real-time:** Socket.io
- **Database:** PostgreSQL (Primary), Better-SQLite3
- **Integrations:** LIFF (LINE), Capacitor (Android)

---

## 🚀 Getting Started (เริ่มต้นใช้งาน)

1. **Clone & Install:**
   ```bash
   git clone https://github.com/Smallzoamz/POS2025.git
   npm install
   ```
2. **Setup Environment:**
   สร้างไฟล์ `.env` และตั้งค่าฐานข้อมูลตามตัวอย่างใน `.env.example`
3. **Run Dev Mode:**
   ```bash
   npm run dev
   ```

---

## 🏗️ Project Structure (โครงสร้างโปรเจกต์)

- `/src`: Frontend & UI Components
- `/electron`: Backend API & DB Logic
- `PROJECT_LOG.md`: Development History (Check this for detailed logs)

---

## 💝 Credits
Powered by **Bonchon-Studio** 🚀
© 2026 POS-2025. All rights reserved.
