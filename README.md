# DSR TRACTORS — Mobile-First Business Management Application

A real, production-ready, mobile-first business web application built for **DSR TRACTORS** to manage agricultural machinery usage calculation, customer ledgers, payment tracking, and multi-tractor diesel tracking.

---

## 🚜 Core Features

1. **Machinery Usage Calculator (Section 1)**
   - **5-Kalappai**: ₹1,200/hour
   - **9-Kalappai**: ₹1,200/hour
   - **Paar Kalappai**: ₹1,200/hour
   - **Rotavator**: ₹1,300/hour
   - **Tanker**: ₹1,000/load
   - **Solam**:
     - *ஆள் உண்டு (With Labor)*: ₹100/bundle
     - *ஆள் இல்லை (Without Labor)*: ₹75/bundle
   - **Manjal (Turmeric)**: ₹1,000/load
   - Real-time subtotal, multi-service transaction items, and grand total calculations.
   - One-click linkage to customer ledger.

2. **Customer Ledger & History (Section 2)**
   - Search by name, phone number, or village.
   - Comprehensive ledger cards showing **Total Billed**, **Paid**, **Balance Due**, and **Status Badges** (`Pending`, `Partially Paid`, `Fully Settled`).
   - Customer details timeline showing all services and receipts.
   - Celebratory confetti upon full settlement.

3. **Payment Management**
   - Record collections via **Cash**, **UPI**, **Bank Transfer**, or **Other**.
   - Immediate balance recalculation across all views.
   - Filter by date range, payment method, and customer.

4. **Tractor Diesel Calculator (Section 3)**
   - Dedicated management for all 3 fleet vehicles:
     1. **SWARAJ 50HP**
     2. **SWARAJ 46HP**
     3. **SWARAJ (OLD)**
   - **Dual Fuel Modes**:
     - *Amount Mode*: Rupee amount divided by configurable diesel price per litre (e.g. ₹3,000 at ₹100.50/L ≈ 29.85 L).
     - *Litre Mode*: Direct fuel available entry (e.g. 30.11 L).
   - **Multiple Work Timings**: Add multiple shifts (e.g. 1.25 hr + 1.25 hr = 2.50 hr).
   - **Consumption Rule**: 1 hour = 4 litres.
   - **Fuel Tank Progress Gauge**: Real-time remaining fuel in tank.
   - **Safety Alert**: Highlights `INSUFFICIENT DIESEL` and prevents negative fuel values.

5. **Real-time Operations Dashboard**
   - Live database metrics: Today's Revenue, Today's Payments, Pending Amount, Today's Diesel Usage.
   - Fuel cards for all 3 tractors with color-coded level indicators.
   - Live activity feed stream.

6. **Adaptive Data Architecture**
   - Seamlessly operates in **Supabase PostgreSQL Mode** with Supabase Realtime when credentials are configured in `.env`.
   - Automatically provides a **Persistent Offline Local Mode** with seeded demo data when credentials are not yet set.

7. **Mobile-First UX & PWA Ready**
   - Optimized for mobile viewports (360px – 430px) with bottom navigation and touch-friendly (≥48px) buttons.
   - Full desktop layout with collapsible sidebar.
   - Light and Dark appearance modes.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Mobile-first CSS design tokens with Dark Mode support
- **Backend / Database**: Supabase (PostgreSQL, Supabase Auth, Supabase Realtime)
- **Icons**: Lucide React
- **Testing**: Vitest (100% test coverage for calculation rules)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```
*(If left blank, the application operates in local persistent offline mode with full functionality and sample data)*.

### 3. Setup Supabase Database
1. Open your Supabase project dashboard.
2. Navigate to the **SQL Editor**.
3. Copy and run the contents of [`supabase/schema.sql`](file:///c:/Users/vigne/OneDrive/Desktop/DSR%20Tracters/supabase/schema.sql) to create tables, constraints, indexes, and RLS policies.
4. Run [`supabase/seed.sql`](file:///c:/Users/vigne/OneDrive/Desktop/DSR%20Tracters/supabase/seed.sql) to seed default tractors, services, and sample customer records.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) on your phone or browser.

### 5. Run Tests
```bash
npm test
```
Verifies all 11 test cases specified in the MVP requirements.

### 6. Build for Production
```bash
npm run build
```

---

## 🌐 Deploying to Vercel

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: complete DSR TRACTORS MVP application"
   git remote add origin https://github.com/your-username/dsr-tractors.git
   git push -u origin main
   ```
2. In Vercel, click **Add New Project** and import the GitHub repository.
3. In **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Click **Deploy**.
