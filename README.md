# 🍽️ POS-2025: Tasty Station Management System

[![Framework](https://img.shields.io/badge/Framework-React_18-61DAFB?logo=react)](https://reactjs.org/)
[![Runtime](https://img.shields.io/badge/Runtime-Electron-47848F?logo=electron)](https://www.electronjs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql)](https://www.postgresql.org/)
[![Realtime](https://img.shields.io/badge/Realtime-Socket.io-010101?logo=socket.io)](https://socket.io/)

**POS-2025** is a premium, high-performance Point of Sale (POS) and Store Management system designed for modern restaurants and cafes. Built with **React**, **Electron**, and **PostgreSQL**, it offers a seamless blend of local reliability and cloud-ready features.

---

## ✨ Key Features

### 🪑 Table & Floor Management
- **Interactive Grid View:** Manage active tables, orders, and statuses in real-time.
- **Dynamic Zone Allocation:** Organize your store into distinct areas (Indoor, Outdoor, VIP, etc.).
- **Visual Floor Plan (Experimental):** Design your store layout with a drag-and-drop editor (Currently in development).

### 📝 Order Processing
- **Omni-channel Ordering:** Centralized system for In-store (Dine-in), Takeaway, and **LINE Integration**.
- **Real-time Kitchen Display (KDS):** Instant synchronization between front-of-house and kitchen/bar stations.
- **Smart Stock Deduction:** Automatic inventory reduction based on recipes and order options.

### 💳 Payment & Loyalty
- **PromptPay Integration:** Auto-generate dynamic QR codes for instant payments.
- **Loyalty Program:** Comprehensive coupon and promotion system to reward recurring customers.
- **Full Transaction History:** Traceable sales logs with detailed breakdown.

### 📊 Analytics & Insights
- **Live Dashboard:** Real-time monitoring of revenue, order volume, and active customers.
- **Top Items Tracking:** Identify your best-sellers at a glance.
- **Sales Trends:** Visualized data to help you plan your business strategy.

---

## 🛠️ Technology Stack

- **Frontend:** React 18, Tailwind CSS, Recharts (Data Visualization)
- **Backend:** Node.js (Express), Electron (Desktop Bridge)
- **Real-time:** Socket.io for instant cross-device synchronization
- **Database:** PostgreSQL (Primary), Better-SQLite3 (Local cache/edge cases)
- **Mobile Integration:** LIFF (LINE Frontend Framework) & Capacitor for Android support

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (Latest LTS)
- [PostgreSQL](https://www.postgresql.org/) (Running local or remote instance)

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Smallzoamz/POS2025.git
   cd POS2025
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file based on `.env.example` and provide your database credentials and API keys.

4. **Launch the development environment:**
   ```bash
   npm run dev
   ```

---

## 🏗️ Project Structure

- `/src`: React frontend components and design system.
- `/electron`: Background processes, API routes, and database controllers.
- `/public`: Static assets and icons.
- `PROJECT_LOG.md`: Detailed changelog and development history.

---

## 💝 Credits & Contributors
Powered by **Bonchon-Studio** 🚀

© 2026 POS-2025. All rights reserved.
