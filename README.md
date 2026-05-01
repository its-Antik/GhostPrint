# 👻 GhostPrint
**High-Performance P2P Campus Print Network**

GhostPrint is a decentralized printing ecosystem designed for college campuses. It connects students who need prints (Buyers) with students who own printers (Runners).

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/its-Antik/GhostPrint.git
cd GhostPrint
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
1. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and fill in your own Supabase, Google Auth, and Telegram keys.

### 4. Database Setup
Run the SQL scripts provided in the root directory in your Supabase SQL Editor:
- `profiles_schema.sql`
- `orders_schema.sql`
- `ghost_chat_schema.sql` (for Live Chat)
- `ghost_anti_fraud.sql` (for security)

### 5. Run the app
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## 🛠️ Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database/Auth**: Supabase + NextAuth.js
- **Styling**: Tailwind CSS + Framer Motion
- **Storage**: Telegram API (Infinite S3 Proxy)
- **Realtime**: Supabase Realtime + Smart Polling Fallback
