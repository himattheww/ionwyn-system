// Auto-generated types untuk Supabase database
// Nanti bisa di-generate otomatis pakai: npx supabase gen types typescript

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Currency = 'IDR' | 'USD' | 'SGD' | 'EUR' | 'MYR'

export type TransactionType = 'income' | 'expense'

export type ExpenseCategory = 'utama' | 'jajan' | 'tabungan' | 'dana_darurat'

export type IncomeCategory = 'gaji' | 'freelance' | 'bisnis' | 'lainnya'

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

// ─── Tabel profiles ───────────────────────────────────────────────
export type Profile = {
  id: string                    // UUID, sama dengan auth.users.id
  full_name: string | null
  avatar_url: string | null
  currency: Currency
  monthly_income: number | null // Pendapatan bulanan (untuk hitung alokasi)
  onboarding_done: boolean      // Sudah setup budget allocation?
  telegram_chat_id: number | null
  created_at: string
  updated_at: string
}

// ─── Tabel telegram_link_tokens ───────────────────────────────────
export type TelegramLinkToken = {
  token: string
  chat_id: number
  telegram_username: string | null
  created_at: string
  expires_at: string
}

// ─── Tabel transactions ───────────────────────────────────────────
export type Transaction = {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  category: ExpenseCategory | IncomeCategory
  note: string | null
  date: string                  // ISO date: '2025-06-01'
  recurring_id: string | null   // null = transaksi biasa
  created_at: string
}

// ─── Tabel recurring_transactions ─────────────────────────────────
export type RecurringTransaction = {
  id: string
  user_id: string
  name: string                  // Contoh: "Spotify Premium"
  type: TransactionType
  amount: number
  category: ExpenseCategory | IncomeCategory
  frequency: RecurringFrequency
  start_date: string
  next_due_date: string
  is_active: boolean
  created_at: string
}

// ─── Tabel budget_allocations ─────────────────────────────────────
export type BudgetAllocation = {
  id: string
  user_id: string
  month: string                 // Format: '2025-06' (YYYY-MM)
  utama_pct: number             // Persentase (0-100)
  jajan_pct: number
  tabungan_pct: number
  dana_darurat_pct: number      // Sub dari tabungan_pct
  utama_amount: number          // Nominal hasil hitung dari income
  jajan_amount: number
  tabungan_amount: number
  dana_darurat_amount: number
  created_at: string
  updated_at: string
}

// ─── Tabel saving_goals ───────────────────────────────────────────
export type SavingGoal = {
  id: string
  user_id: string
  name: string                  // Contoh: "Beli Laptop"
  target_amount: number
  current_amount: number
  deadline: string | null       // ISO date
  is_completed: boolean
  created_at: string
  updated_at: string
}

// ─── Tabel monthly_reports ────────────────────────────────────────
export type MonthlyReport = {
  id: string
  user_id: string
  month: string                 // Format: '2025-06'
  total_income: number
  total_expense: number
  total_saved: number
  ai_summary: string | null     // AI-generated summary text
  generated_at: string
}

type TelegramTokenInsert = Pick<TelegramLinkToken, 'token' | 'chat_id'> &
  Partial<Omit<TelegramLinkToken, 'token' | 'chat_id'>>
type ProfileInsert = Pick<Profile, 'id'> & Partial<Omit<Profile, 'id'>>
type TransactionInsert = Omit<Transaction, 'id' | 'created_at' | 'recurring_id' | 'category'> & {
  id?: string
  category: string
  recurring_id?: string | null
}
type RecurringInsert = Omit<RecurringTransaction, 'id' | 'created_at' | 'category' | 'is_active'> & {
  category: string
  is_active?: boolean
}
type BudgetInsert = Pick<BudgetAllocation, 'user_id' | 'month'> &
  Partial<Omit<BudgetAllocation, 'id' | 'user_id' | 'month' | 'created_at' | 'updated_at'>>
type GoalInsert = Pick<SavingGoal, 'user_id' | 'name' | 'target_amount'> &
  Partial<Omit<SavingGoal, 'id' | 'user_id' | 'name' | 'target_amount' | 'created_at' | 'updated_at'>>
type ReportInsert = Pick<MonthlyReport, 'user_id' | 'month'> &
  Partial<Omit<MonthlyReport, 'id' | 'user_id' | 'month'>>

// ─── Supabase Database type ────────────────────────────────────────
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
        Relationships: []
      }
      transactions: {
        Row: Transaction
        Insert: TransactionInsert
        Update: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      recurring_transactions: {
        Row: RecurringTransaction
        Insert: RecurringInsert
        Update: Partial<Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      budget_allocations: {
        Row: BudgetAllocation
        Insert: BudgetInsert
        Update: Partial<Omit<BudgetAllocation, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      saving_goals: {
        Row: SavingGoal
        Insert: GoalInsert
        Update: Partial<Omit<SavingGoal, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      telegram_link_tokens: {
        Row: TelegramLinkToken
        Insert: TelegramTokenInsert
        Update: Partial<Omit<TelegramLinkToken, 'token' | 'created_at'>>
        Relationships: []
      }
      monthly_reports: {
        Row: MonthlyReport
        Insert: ReportInsert
        Update: Partial<Omit<MonthlyReport, 'id' | 'user_id'>>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      telegram_link_info: {
        Args: { p_token: string }
        Returns: { telegram_username: string | null; expired: boolean }[]
      }
      link_telegram: {
        Args: { p_token: string }
        Returns: undefined
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
} 