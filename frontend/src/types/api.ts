/**
 * TypeScript contracts matching rezekify REST API.
 */

export type AccountType = 'CASH' | 'BANK' | 'EWALLET' | 'LIABILITY';
export type VaultType = 'SAVINGS' | 'FIXED_BILL';
export type EntryType = 'DEBIT' | 'CREDIT';
export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface User {
  id: string;
  email: string;
  full_name: string;
  telegram_chat_id?: number | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: User;
}

export interface Account {
  id: string;
  name: string;
  account_type: AccountType;
  current_balance: number;
  is_active: boolean;
}

export interface Vault {
  id: string;
  name: string;
  vault_type: VaultType;
  target_amount: number;
  allocated_amount: number;
  target_date?: string | null;
  is_locked: boolean;
}

export interface UpcomingBill {
  name: string;
  target_amount: number;
  allocated_amount: number;
  target_date: string;
  days_until_due: number;
}

export interface DashboardSummaryResponse {
  total_liquid_cash: number;
  vault_locked_cash: number;
  operational_free_cash: number;
  days_remaining: number;
  daily_safe_runway: number;
  health_status: HealthStatus;
  upcoming_bills: UpcomingBill[];
}

export interface LedgerEntry {
  id: string;
  account_id?: string | null;
  category_id?: string | null;
  vault_id?: string | null;
  entry_type: EntryType;
  amount: number;
}

export interface Transaction {
  id: string;
  description: string;
  source_channel: string;
  transaction_date: string;
  raw_input_text?: string | null;
  receipt_image_url?: string | null;
  ledger_entries?: LedgerEntry[];
}

export interface ChatResponse {
  reply: string;
}
