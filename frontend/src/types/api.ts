/**
 * TypeScript contracts matching rezekify REST API.
 */

export type AccountType = 'CASH' | 'BANK' | 'EWALLET' | 'LIABILITY';
export type VaultType = 'SAVINGS' | 'FIXED_BILL';
export type CategoryType = 'EXPENSE' | 'INCOME';
export type EntryType = 'DEBIT' | 'CREDIT';
export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';
export type GuidanceTone = 'CRITICAL' | 'WARNING' | 'HEALTHY';

export interface SurvivalGuidance {
  headline: string;
  message: string;
  tactical_action: string;
  tone: GuidanceTone;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  telegram_chat_id?: number | null;
}

export type UserProfile = User;

export interface Category {
  id: string;
  name: string;
  category_type?: CategoryType | string;
  icon?: string;
  color?: string;
}

export interface CategoryCreateRequest {
  name: string;
  category_type?: CategoryType;
  icon?: string;
  color?: string;
}

export interface CategoryUpdateRequest {
  name?: string;
  category_type?: CategoryType;
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

export interface AccountUpdateRequest {
  name?: string;
  account_type?: AccountType;
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

export interface VaultCreateRequest {
  name: string;
  vault_type: VaultType;
  target_amount: number;
  allocated_amount?: number;
  target_date?: string | null;
  is_locked?: boolean;
}

export interface VaultUpdateRequest {
  name: string;
  target_amount: number;
  allocated_amount: number;
  target_date?: string | null;
}

export interface VaultDepositRequest {
  amount: number;
  source_account_id?: string | null;
}

export interface VaultPayBillRequest {
  account_id: string;
  category_id?: string | null;
  amount?: number | null;
  notes?: string | null;
}

export interface VaultPayBillResponse {
  vault: Vault;
  transaction: Transaction;
}

export type DistributionStrategy = 'PRIORITY_BILLS' | 'PROPORTIONAL' | 'CUSTOM';

export interface VaultAllocationItem {
  vault_id: string;
  amount: number;
}

export interface VaultDistributeRequest {
  total_amount: number;
  source_account_id?: string | null;
  allocations: VaultAllocationItem[];
}

export interface VaultDistributeResponse {
  total_allocated: number;
  source_account_id?: string | null;
  vaults: Vault[];
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
  today_spent?: number;
  safe_runway_threshold?: number;
  health_status: HealthStatus;
  upcoming_bills: UpcomingBill[];
  survival_guidance?: SurvivalGuidance;
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
  created_at?: string;
  raw_input_text?: string | null;
  receipt_image_url?: string | null;
  ledger_entries?: LedgerEntry[];
  amount?: number;
  type?: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  category_name?: string | null;
  account_name?: string | null;
}

export interface PaginatedTransactionsResponse {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TransactionFilterParams {
  account_id?: string;
  category_id?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface ChatResponse {
  reply: string;
}

export interface VoiceChatResponse {
  reply: string;
  transcription?: string;
}

export interface ReceiptExtractedData {
  action: string;
  amount: number;
  account_name?: string | null;
  category_name?: string | null;
  note?: string | null;
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

export interface TransactionCreateRequest {
  transaction_type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: number;
  description: string;
  account_id?: string;
  category_id?: string;
  from_account_id?: string;
  to_account_id?: string;
  transaction_date?: string;
  source_channel?: string;
  vault_id?: string | null;
}

export interface TransactionUpdateRequest {
  transaction_type?: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: number;
  description: string;
  account_id?: string;
  category_id?: string;
  from_account_id?: string;
  to_account_id?: string;
  transaction_date?: string;
  vault_id?: string | null;
}

export type AIProviderType = 'SYSTEM' | 'CUSTOM';
export type AIProtocolType = 'OPENAI' | 'ANTHROPIC';

export interface TelegramSettingsResponse {
  is_connected: boolean;
  telegram_chat_id?: number | null;
  bot_username: string;
}

export interface AISettingsResponse {
  is_custom_ai_enabled: boolean;
  provider: AIProviderType;
  protocol?: AIProtocolType | null;
  base_url?: string | null;
  model: string;
  has_api_key: boolean;
  key_hint?: string | null;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  full_name: string;
  monthly_cycle_day: number;
  safe_runway_threshold: number;
}

export interface UserProfileUpdateRequest {
  monthly_cycle_day?: number;
  safe_runway_threshold?: number;
}

export interface SettingsResponse {
  telegram: TelegramSettingsResponse;
  ai: AISettingsResponse;
  profile?: UserProfileResponse;
}

export interface AIKeyValidateRequest {
  protocol: AIProtocolType;
  base_url: string;
  api_key: string;
  model?: string;
}

export interface AIKeyValidateResponse {
  valid: boolean;
  message: string;
}

export interface AISettingsUpdateRequest {
  is_custom_ai_enabled: boolean;
  provider: AIProviderType;
  protocol?: AIProtocolType | null;
  base_url?: string | null;
  model: string;
  api_key?: string | null;
}

export interface TelegramUnlinkResponse {
  success: boolean;
  message: string;
}

export interface TelegramPairingCodeResponse {
  pairing_code: string;
}

export interface TransactionSummary {
  id: string;
  amount: number;
  account_name: string;
  category_name: string;
  description: string;
  type: string; // 'EXPENSE' | 'INCOME' | 'TRANSFER'
  account_balance_after?: number | null;
}

export interface TelemetrySnapshot {
  operational_free_cash: number;
  daily_safe_runway: number;
  days_remaining: number;
  health_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface EnrichedChatResponse {
  reply: string;
  thought?: string | null;
  message_id?: string | null;
  transaction?: TransactionSummary | null;
  telemetry?: TelemetrySnapshot | null;
  transcription?: string | null;
  traces?: Array<{ hop?: number; thought?: string; tool_name?: string; tool_args?: any; observation?: any }>;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transaction_id?: string | null;
  transaction?: TransactionSummary | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp_code: string;
  new_password: string;
}

export interface GenericMessageResponse {
  message: string;
}



