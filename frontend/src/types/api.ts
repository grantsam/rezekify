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

export type UserProfile = User;

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: User;
}

export interface Category {
  id: string;
  name: string;
  category_type?: string;
  icon?: string;
  color?: string;
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

export interface ReceiptExtractedData {
  action: string;
  amount: number;
  account_name?: string | null;
  category_name?: string | null;
  note?: string | null;
}

export interface ReceiptUploadResponse {
  reply: string;
  transaction_id?: string | null;
  extracted_data: ReceiptExtractedData;
}

export interface DailySpendingItemModel {
  date: string;
  day_label: string;
  amount: number;
  safe_runway_threshold: number;
  is_over_budget: boolean;
}

export interface DailySpendingResponse {
  period: 'daily';
  daily_safe_runway: number;
  total_spent_in_period: number;
  items: DailySpendingItemModel[];
}

export interface CategorySpendingItemModel {
  category_id?: string | null;
  category_name: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface MonthlySpendingResponse {
  period: 'monthly';
  cycle_start_date: string;
  cycle_end_date: string;
  total_spent: number;
  items: CategorySpendingItemModel[];
}

export type SpendingBreakdownResponse = DailySpendingResponse | MonthlySpendingResponse;

export interface TransactionUpdateRequest {
  transaction_type?: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: number;
  description: string;
  account_id?: string;
  category_id?: string;
  from_account_id?: string;
  to_account_id?: string;
  transaction_date?: string;
}


