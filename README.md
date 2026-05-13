# 👻 GhostPrint — The Blueprint

**High-Performance P2P Campus Print Network**

GhostPrint is a decentralized printing ecosystem designed for college campuses. It connects students who need prints (Buyers) with students who own printers (Runners) through a real-time peer-to-peer marketplace.

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  Next.js 14 (App Router) + Tailwind + Framer Motion  │
│  ┌───────────┐  ┌───────────┐  ┌──────────────┐     │
│  │  Landing   │  │ Dashboard │  │  Admin Panel  │     │
│  │  (page.tsx)│  │ (Buyer/   │  │  (/admin)    │     │
│  │           │  │  Runner)  │  │              │     │
│  └───────────┘  └───────────┘  └──────────────┘     │
└──────────────────────┬───────────────────────────────┘
                       │  NextAuth JWT
                       ▼
┌──────────────────────────────────────────────────────┐
│                  API LAYER (Next.js)                  │
│  /api/orders  /api/chat  /api/profile  /api/system   │
│  /api/expansion  /api/notifications  /api/contact    │
│  /api/admin/notify  /api/admin/reset-balance         │
│  /api/push/subscribe  /api/telegram-upload           │
│  /api/telegram-file                                  │
└──────────────────────┬───────────────────────────────┘
                       │  Service Role Key (bypasses RLS)
                       ▼
┌──────────────────────────────────────────────────────┐
│              SUPABASE (PostgreSQL)                    │
│  Tables: orders, profiles, chat_messages,            │
│          notifications, expansion_requests,          │
│          colleges, global_settings,                  │
│          push_subscriptions, support_tickets         │
│  Views: campus_leaderboard                           │
│  Realtime: orders, notifications, chat_messages      │
│  Cron: ghost-maintenance (cleanup every 6h)          │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                       │
│  Telegram Bot API — File storage (infinite S3 proxy) │
│  Google OAuth — Authentication                       │
│  Web Push (VAPID) — Native notifications             │
└──────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/its-Antik/GhostPrint.git
cd GhostPrint
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — server-side bypass for RLS |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_URL` | App URL (http://localhost:3000 locally) |
| `NEXTAUTH_SECRET` | Random secret for JWT signing |
| `TELEGRAM_BOT_TOKEN` | Telegram bot for file storage & alerts |
| `TELEGRAM_CHANNEL_ID` | Channel for file upload notifications |
| `TELEGRAM_SUPPORT_CHANNEL_ID` | Channel for support ticket pings |
| `TELEGRAM_EXPANSION_CHANNEL_ID` | Channel for campus expansion requests |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `ADMIN_EMAIL` / `NEXT_PUBLIC_ADMIN_EMAIL` | Admin email for bypass + UI controls |

### 3. Database Setup
Run these SQL scripts **in order** in Supabase SQL Editor:

1. `profiles_schema.sql` — User profiles with runner rates & balances
2. `orders_schema.sql` — Orders table with status enum
3. `fix_fk.sql` — Removes FK constraint to auth.users (NextAuth compat)
4. `ghost_chat_schema.sql` — Chat messages between buyer & runner
5. `notifications_schema.sql` — In-app notification system + realtime
6. `ghost_anti_fraud.sql` — Anti-fraud triggers & rate limiting
7. `ghost_privacy_cleanup.sql` — Auto-cleanup of sensitive data
8. `expansion_schema.sql` — Campus expansion request system
9. `expansion_normalization.sql` — Domain-first grouping fix
10. `multi_tenant_schema.sql` — Multi-campus isolation (colleges table)
11. `ghost_maintenance.sql` — Auto-cleanup cron + global_settings kill-switch

### 4. Run Locally
```bash
npm run dev
```
App runs at `http://localhost:3000`.

---

## 📡 API Endpoints

### Authentication
All API routes (except `/api/system GET` and `/api/expansion GET`) require a valid NextAuth session. The server uses `getServerSession()` to verify the JWT and extract `user.email`.

### `/api/orders`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `POST` | Create a new print order | ✅ | `{ total_pages, total_cost, file_metadata[], delivery_location }` |
| `GET` | Fetch orders (filtered) | ✅ | `?status=searching,accepted&runner_id=email&buyer_id=email` |
| `PATCH` | Update order status / claim job | ✅ | `{ order_id, status?, runner_id? }` |

**Security:**
- Orders are tagged with `college_domain` from the session
- Runners only see `searching` orders from their own campus
- `runner_id` / `buyer_id` queries are locked to the session user
- Race condition protection: claiming uses `.is('runner_id', null)` filter

**Notifications triggered on:**
- `POST` → Web Push + in-app to all same-campus active runners
- `PATCH (accepted)` → Notify buyer, notify other runners that gig was claimed
- `PATCH (printing/ready/delivered/cancelled)` → Notify relevant party

### `/api/chat`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `GET` | Fetch messages for an order | ✅ | `?order_id=UUID` |
| `POST` | Send a chat message | ✅ | `{ order_id, text, is_quick_card? }` |

**Security:** Only the buyer or runner of the order can read/write messages. Messages are capped at 500 characters. Chat is blocked on `delivered`/`cancelled` orders.

### `/api/profile`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `GET` | Fetch signed-in user's profile | ✅ | — |
| `POST` | Create or update profile | ✅ | `{ full_name?, department?, whatsapp_no?, is_runner_active?, bw_rate?, color_rate?, dues?, bonus? }` |

### `/api/notifications`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `GET` | Fetch last 10 notifications | ✅ | — |
| `PATCH` | Mark notifications as read | ✅ | `{ action: "mark_all_read" }` or `{ notification_id }` |

Auto-prunes beyond 10 notifications per user.

### `/api/expansion`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `GET` | Fetch leaderboard or lookup a domain | 🔓 | `?lookup=domain` (optional) |
| `POST` | Submit expansion request | 🔓 | `{ college_name, student_email, campus_size?, ref? }` |

**Domain Normalization:**
- Groups requests by email domain, not college name
- Auto-corrects college name to the canonical entry for a domain
- Rejects personal emails (Gmail, Yahoo, etc.)
- One request per email, enforced at DB level

### `/api/system`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `GET` | Check if system is active | 🔓 | — |
| `PATCH` | Toggle system on/off (kill-switch) | ✅ Admin | `{ active: boolean, message?, estimated_uptime? }` |

### `/api/contact`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `POST` | Submit a support ticket | ✅ | `{ category, message }` |

Pings Telegram support channel + inserts into `support_tickets`.

### `/api/admin/notify`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `POST` | Broadcast notification to users | ✅ Admin | `{ title, message, target }` |

Target can be `"all"`, a specific email, or `"all@domain"` for campus-scoped broadcasts.

### `/api/admin/reset-balance`

| Method | Description | Auth |
|--------|-------------|------|
| `POST` | Reset a runner's debt balance | ✅ Admin |

### `/api/push/subscribe`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `POST` | Register Web Push subscription | ✅ | `{ subscription: PushSubscription }` |

### `/api/telegram-upload`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `POST` | Upload a file via Telegram bot | ✅ | `FormData { file }` |

Returns `{ url, file_id }` — the file is stored on Telegram's servers (infinite, free).

### `/api/telegram-file`

| Method | Description | Auth | Params |
|--------|-------------|------|--------|
| `GET` | Proxy a Telegram file download | ✅ | `?file_id=TELEGRAM_FILE_ID` |

Verifies the requester is the buyer or runner of the associated order before proxying.

---

## 🛡️ Security Model

### Authentication
- **Provider:** Google OAuth via NextAuth.js
- **Strategy:** JWT (no database sessions)
- **Domain Gating:** Only emails from registered college domains can sign in
- **Admin Bypass:** `ADMIN_EMAIL` always passes auth checks

### Data Isolation (Multi-Tenant)
- **Application-Layer:** All queries filter by `college_domain` extracted from the JWT
- **No RLS dependency:** We use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) and enforce tenant isolation in application code via `.eq('college_domain', userDomain)` on every query
- **Realtime Scoping:** Supabase channels are namespaced by domain (e.g., `runner_orders_heritageit.edu.in`)

### RLS Policies (Defense-in-Depth)
Even though the app uses service role, these RLS policies exist as a safety net:

| Table | Policy | Rule |
|-------|--------|------|
| `orders` | Buyers view own | `auth.jwt() ->> 'email' = buyer_id` |
| `orders` | Runners view claimed | `auth.jwt() ->> 'email' = runner_id` |
| `orders` | View available gigs | `status in ('searching', 'pending')` |
| `expansion_requests` | Public insert | `true` |
| `expansion_requests` | Public select | `true` |
| `global_settings` | Public read | `true` |
| `notifications` | User reads own | `auth.jwt() ->> 'email' = user_email` |

### Safety Mechanisms
- **Order Safety Mode:** Auto-cancels `searching` orders if buyer switches tabs
- **Anti-Fraud:** `ghost_anti_fraud.sql` triggers prevent order manipulation
- **Race Condition Guard:** Job claiming uses `.is('runner_id', null)` + returns `409` on conflict
- **Notification Pruning:** Max 10 per user, auto-cleaned
- **Auto-Cleanup Cron:** Completed/cancelled orders deleted after 24 hours

---

## 🗄️ Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `orders` | Print job lifecycle | `buyer_id`, `runner_id`, `status`, `college_domain`, `file_metadata (jsonb)`, `pickup_code` |
| `profiles` | User data + runner config | `username (email)`, `college_domain`, `is_runner_active`, `bw_rate`, `color_rate`, `dues`, `bonus` |
| `chat_messages` | Per-order messaging | `order_id`, `sender_id`, `text`, `is_quick_card` |
| `notifications` | In-app notification feed | `user_email`, `title`, `message`, `type`, `is_read` |
| `colleges` | Registered campus registry | `email_domain`, `college_name`, `is_active` |
| `expansion_requests` | Campus waitlist | `student_email`, `college_name`, `email_domain`, `campus_size` |
| `global_settings` | System config (kill-switch) | `key`, `value (jsonb)` |
| `support_tickets` | Help requests | `category`, `message`, `status` |

### Views
| View | Purpose |
|------|---------|
| `campus_leaderboard` | Aggregated expansion requests grouped by `email_domain`, with `mode()` for canonical college name |

### Automated Jobs
| Job | Schedule | Action |
|-----|----------|--------|
| `ghost-maintenance` | Every 6 hours | Deletes `delivered`/`cancelled` orders older than 24 hours + orphaned chat messages |

---

## 🔌 Realtime Architecture

GhostPrint uses Supabase Realtime with smart lifecycle management:

1. **`useSmartRealtime` hook** — Auto-disconnects after 10 min idle or when tab backgrounds. Prevents hitting Supabase's 500-connection ceiling from idle phones.
2. **Order Dot Watcher** — Direct Postgres listener on `orders` table INSERT/UPDATE for activity dots, scoped by `college_domain`.
3. **Notification Listener** — Postgres listener on `notifications` table for the bell icon + GhostPing toasts.
4. **Polling Fallback** — 5-second polling for order tracking (since RLS may block Realtime for NextAuth users).

---

## 🚨 Emergency Kill-Switch

If something goes wrong during exams or a major bug appears:

1. **Quick Toggle:** `PATCH /api/system` with `{ "active": false, "message": "Bug fix in progress", "estimated_uptime": "2 hours" }`
2. **Direct DB:** Update `global_settings` table: `UPDATE global_settings SET value = '{"active": false, "message": "...", "estimated_uptime": "4 hours"}' WHERE key = 'is_system_active';`
3. **Frontend:** A full-screen terminal overlay ("SYSTEM OFFLINE") blocks all interaction
4. **Auto-Recovery:** The overlay polls every 30 seconds and auto-dismisses when system comes back online
5. **Telegram Alert:** Status changes trigger an automatic Telegram ping to the support channel

---

## 📁 File Structure

```
Ghost Printer/
├── app/
│   ├── page.tsx                    # Landing page (3D + steps + expansion)
│   ├── dashboard/page.tsx          # Main buyer/runner dashboard
│   ├── admin/page.tsx              # Admin panel
│   ├── auth/
│   │   ├── signin/page.tsx         # Custom sign-in page
│   │   └── error/page.tsx          # Auth error → expansion funnel
│   └── api/
│       ├── auth/[...nextauth]/     # NextAuth config
│       ├── orders/                 # CRUD for print jobs
│       ├── chat/                   # Order-scoped messaging
│       ├── profile/                # User profile management
│       ├── notifications/          # In-app notifications
│       ├── system/                 # Kill-switch API
│       ├── expansion/              # Campus expansion requests
│       ├── contact/                # Support tickets
│       ├── admin/notify/           # Broadcast notifications
│       ├── admin/reset-balance/    # Runner debt reset
│       ├── push/subscribe/         # Web Push registration
│       ├── telegram-upload/        # File upload via Telegram
│       ├── telegram-file/          # File download proxy
│       └── upload/                 # Legacy upload route
├── components/
│   ├── CampusExpansion.tsx         # Expansion request + leaderboard
│   ├── DebtDashboard.tsx           # Runner dues tracker
│   ├── GhostChat.tsx               # Per-order chat widget
│   ├── GhostPing.tsx               # Toast notification system
│   ├── LiveCampusFeed.tsx          # Scrolling campus activity ticker
│   ├── MaintenanceOverlay.tsx      # Kill-switch terminal overlay
│   ├── NotificationBell.tsx        # Header notification bell
│   ├── Onboarding.tsx              # First-time user flow
│   ├── PushNotificationManager.tsx # Web Push setup UI
│   ├── RateCard.tsx                # Runner pricing config
│   ├── RazorpayCheckout.tsx        # Payment integration stub
│   ├── RunnerSetup.tsx             # Runner onboarding wizard
│   └── UploadManager.tsx           # File upload + preview
├── hooks/
│   ├── useSmartRealtime.ts         # Lifecycle-aware Supabase listener
│   └── useNotifications.ts         # Notification polling + state
├── lib/
│   └── supabase.ts                 # Supabase client init
├── public/
│   └── Logo.jpg                    # App logo
├── *.sql                           # Database migration scripts
├── .env.example                    # Environment variable template
└── package.json
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth.js + Google OAuth |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime + Smart Polling |
| File Storage | Telegram Bot API (infinite, free) |
| Notifications | Web Push (VAPID) + In-App |
| Styling | Tailwind CSS |
| Animation | Framer Motion + React Three Fiber |
| 3D | Three.js (landing page background) |

---

## 📝 Onboarding a New Developer

1. Clone the repo and run `npm install`
2. Get Supabase, Google OAuth, and Telegram credentials
3. Copy `.env.example` → `.env.local` and fill in all values
4. Run all SQL scripts in order (see Database Setup above)
5. Read the API Endpoints section to understand the data flow
6. Key files to start with:
   - `app/dashboard/page.tsx` — The main app (2000+ lines, all-in-one)
   - `app/api/orders/route.ts` — Core business logic
   - `hooks/useSmartRealtime.ts` — Understand the realtime architecture
   - `components/MaintenanceOverlay.tsx` — Emergency procedures

---

*Built by Antik — a solo engineering project for Heritage IT campus.*
