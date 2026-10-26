# FinTrack — Personal Finance Tracker

Aplikasi manajemen keuangan pribadi dengan Vue 3 dan Supabase.

## Tech Stack

- **Frontend**: Vue 3 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **State**: Pinia
- **Backend**: Supabase (Auth + PostgreSQL + Storage)
- **AI**: Anthropic Claude API (hanya untuk bot Telegram membaca pesan bebas)
- **Charts**: ApexCharts

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Setup environment variables

```bash
cp .env.example .env
```

Isi `.env` dengan nilai dari:
- **Supabase**: https://supabase.com → Settings → API
- **Anthropic**: https://console.anthropic.com

### 3. Setup database Supabase

1. Buat project baru di [supabase.com](https://supabase.com)
2. Pergi ke **SQL Editor → New Query**
3. Copy-paste isi file `src/lib/schema.sql` → klik **Run**

### 4. Setup Google OAuth (opsional)

Di Supabase Dashboard → **Authentication → Providers → Google**:
1. Enable Google provider
2. Isi Client ID & Secret dari [Google Cloud Console](https://console.cloud.google.com)
3. Tambah redirect URL: `https://[project-ref].supabase.co/auth/v1/callback`

### 5. Jalankan app

```bash
npm run dev
```

Buka http://localhost:5173

## Struktur Project

```
src/
├── assets/          → CSS global
├── composables/     → useAuth, dll
├── lib/             → Supabase client, types, schema SQL
├── router/          → Vue Router + navigation guards
├── stores/          → Pinia stores (auth, transactions, budget, goals)
└── views/
    ├── auth/        → Login, Register, Callback
    ├── AuthView.vue
    ├── AppLayout.vue
    ├── DashboardView.vue
    ├── TransactionsView.vue
    ├── ChartsView.vue
    ├── GoalsView.vue
    ├── BudgetView.vue
    └── ProfileView.vue
```

## Development Phase

- [x] Phase 1 — Auth + Supabase setup
- [x] Phase 2 — Halaman Login & Register
- [ ] Phase 3 — AppLayout + Sidebar
- [ ] Phase 4 — Transaksi
- [ ] Phase 5 — Dashboard + Charts
- [ ] Phase 6 — Goals & Budget
- [ ] Phase 8 — Export PDF
