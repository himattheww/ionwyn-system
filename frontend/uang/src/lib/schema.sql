-- ============================================================
-- FinTrack — Supabase SQL Schema
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. PROFILES ─────────────────────────────────────────────────
-- Extends tabel auth.users bawaan Supabase
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  avatar_url      TEXT,
  currency        TEXT NOT NULL DEFAULT 'IDR',
  monthly_income  NUMERIC(15,2),
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-buat profile saat user register
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount        NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  category      TEXT NOT NULL,
  note          TEXT,
  date          DATE NOT NULL,
  recurring_id  UUID,              -- FK ke recurring_transactions (nullable)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk query cepat per user + per bulan
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_category
  ON public.transactions(user_id, category);

-- ─── 3. RECURRING TRANSACTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount        NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  category      TEXT NOT NULL,
  frequency     TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  start_date    DATE NOT NULL,
  next_due_date DATE NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_user
  ON public.recurring_transactions(user_id, is_active);

-- ─── 4. BUDGET ALLOCATIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_allocations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month                TEXT NOT NULL,   -- Format: '2025-06'
  utama_pct            NUMERIC(5,2) NOT NULL DEFAULT 50,
  jajan_pct            NUMERIC(5,2) NOT NULL DEFAULT 30,
  tabungan_pct         NUMERIC(5,2) NOT NULL DEFAULT 20,
  dana_darurat_pct     NUMERIC(5,2) NOT NULL DEFAULT 10, -- Bagian dari tabungan_pct
  utama_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  jajan_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  tabungan_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  dana_darurat_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month)  -- Satu alokasi per user per bulan
);

-- Validasi: total pct tidak boleh lebih dari 100
ALTER TABLE public.budget_allocations
  ADD CONSTRAINT check_total_pct
  CHECK (utama_pct + jajan_pct + tabungan_pct <= 100);

-- Dana darurat tidak boleh lebih dari tabungan
ALTER TABLE public.budget_allocations
  ADD CONSTRAINT check_dana_darurat_pct
  CHECK (dana_darurat_pct <= tabungan_pct);

-- ─── 5. SAVING GOALS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saving_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  target_amount   NUMERIC(15,2) NOT NULL CHECK (target_amount > 0),
  current_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  deadline        DATE,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. MONTHLY REPORTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month           TEXT NOT NULL,   -- Format: '2025-06'
  total_income    NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_expense   NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_saved     NUMERIC(15,2) NOT NULL DEFAULT 0,
  ai_summary      TEXT,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- ─── 7. STORAGE BUCKET (Avatar) ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT DO NOTHING;

-- ─── 8. ROW LEVEL SECURITY (RLS) ─────────────────────────────────
-- RLS memastikan user HANYA bisa akses data miliknya sendiri

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saving_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

-- Profiles: user hanya bisa lihat + edit profile sendiri
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Transactions: CRUD hanya untuk transaksi sendiri
CREATE POLICY "Users can CRUD own transactions"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id);

-- Recurring: CRUD hanya untuk recurring sendiri
CREATE POLICY "Users can CRUD own recurring"
  ON public.recurring_transactions FOR ALL
  USING (auth.uid() = user_id);

-- Budget: CRUD hanya untuk budget sendiri
CREATE POLICY "Users can CRUD own budget"
  ON public.budget_allocations FOR ALL
  USING (auth.uid() = user_id);

-- Goals: CRUD hanya untuk goals sendiri
CREATE POLICY "Users can CRUD own goals"
  ON public.saving_goals FOR ALL
  USING (auth.uid() = user_id);

-- Reports: CRUD hanya untuk report sendiri
CREATE POLICY "Users can CRUD own reports"
  ON public.monthly_reports FOR ALL
  USING (auth.uid() = user_id);

-- Storage: user hanya bisa upload ke folder miliknya
CREATE POLICY "Avatar upload own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Avatar update own folder"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
