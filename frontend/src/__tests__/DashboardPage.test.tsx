import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardPage } from '../pages/DashboardPage';
import { App } from '../App';
import * as apiClient from '../services/apiClient';
import * as AuthContextModule from '../context/AuthContext';

describe('DashboardPage Component', () => {
  const mockLogout = vi.fn();
  const mockUser = {
    id: 'usr-101',
    email: 'user@rezekify.id',
    full_name: 'Budi Santoso',
    telegram_chat_id: 12345,
  };

  const mockSummary = {
    total_liquid_cash: 2500000,
    vault_locked_cash: 500000,
    operational_free_cash: 2000000,
    days_remaining: 20,
    daily_safe_runway: 100000,
    health_status: 'HEALTHY' as const,
    upcoming_bills: [
      {
        name: 'Internet & WiFi',
        target_amount: 350000,
        allocated_amount: 150000,
        target_date: '2026-09-22',
        days_until_due: 4,
      },
    ],
  };

  const mockTransactions = [
    {
      id: 'tx-101',
      description: 'Makan Siang Soto Ayam',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-18T13:00:00Z',
      ledger_entries: [
        { id: 'le-1', entry_type: 'DEBIT' as const, amount: 25000 },
        { id: 'le-2', entry_type: 'CREDIT' as const, amount: 25000 },
      ],
    },
  ];

  const mockAccounts = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK' as const, current_balance: 2000000, is_active: true },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLogout.mockReset();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
    });
  });

  it('renders dashboard with summary, bills banner, and transactions', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 25000, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    expect(screen.getAllByText(/Rezekify/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Deterministic Runway/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Rp 100.000/i)).toBeInTheDocument();
      expect(screen.getByText(/Internet & WiFi/i)).toBeInTheDocument();
      expect(screen.getByText(/Makan Siang Soto Ayam/i)).toBeInTheDocument();
    });
  });

  it('handles text-only submission to /dashboard/ai-chat and refreshes data', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 35000, items: [] };
      }
      if (endpoint === '/dashboard/ai-chat' && options?.method === 'POST') {
        return { reply: 'Berhasil mencatat pengeluaran bensin Rp 35.000 dari BCA.' };
      }
      return null;
    });

    render(<DashboardPage />);

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'beli bensin 35rb bca' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(screen.getByText(/Hasil Konfirmasi AI/i)).toBeInTheDocument();
      expect(screen.getByText(/Berhasil mencatat pengeluaran bensin Rp 35.000/i)).toBeInTheDocument();
    });
  });

  it('handles receipt file submission via FormData to /dashboard/ai-receipt and triggers reactive refresh', async () => {
    let calledWithFormData = false;
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 48500, items: [] };
      }
      if (endpoint === '/dashboard/ai-receipt' && options?.method === 'POST') {
        if (options?.body instanceof FormData) {
          calledWithFormData = true;
        }
        return {
          reply: 'Tercatat dari Struk: Rp 48.500 (Kopi Kenangan) via BCA.',
          transaction_id: 'tx-202',
          extracted_data: { action: 'expense', amount: 48500, account_name: 'BCA', note: 'Kopi Kenangan' },
        };
      }
      return null;
    });

    render(<DashboardPage />);

    const file = new File(['dummy_jpeg_bytes'], 'kopi_struk.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'kopi sore' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(calledWithFormData).toBe(true);
      expect(screen.getByText(/Tercatat dari Struk: Rp 48\.500/i)).toBeInTheDocument();
    });
  });

  it('renders unrecorded receipt with isError: true warning banner when transaction_id is null', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      if (endpoint === '/dashboard/ai-receipt' && options?.method === 'POST') {
        return {
          reply: '❌ Gagal: Struk tidak terbaca jelas. Pastikan foto terang dan menampilkan total belanja.',
          transaction_id: null,
          extracted_data: { action: 'unknown', amount: 0 },
        };
      }
      return null;
    });

    render(<DashboardPage />);

    const file = new File(['blurry_bytes'], 'blurry_struk.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.submit(input);

    await waitFor(() => {
      expect(screen.getByText(/Gagal Memproses/i)).toBeInTheDocument();
      expect(screen.getByText(/Struk tidak terbaca jelas/i)).toBeInTheDocument();
    });
  });

  it('renders friendly onboarding banner when accounts are empty and opens AccountModal via CTA', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return [];
      if (endpoint === '/accounts') return [];
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Selamat datang di Rezekify/i)).toBeInTheDocument();
    });

    const ctaBtn = screen.getByRole('button', { name: /Tambah Rekening Pertama/i });
    expect(ctaBtn).toBeInTheDocument();

    fireEvent.click(ctaBtn);

    expect(screen.getByText('Tambah Akun Baru')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Tutup modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Tambah Akun Baru')).not.toBeInTheDocument();
  });

  it('opens and closes AccountModal from navbar quick action', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Rp 100.000/i)).toBeInTheDocument();
    });

    const openBtn = screen.getByRole('button', { name: /\+ Rekening/i });
    fireEvent.click(openBtn);

    expect(screen.getByText('Tambah Akun Baru')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Tutup modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Tambah Akun Baru')).not.toBeInTheDocument();
  });

  it('opens and closes VaultModal from navbar quick action', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Rp 100.000/i)).toBeInTheDocument();
    });

    const openBtn = screen.getByRole('button', { name: /\+ Tagihan/i });
    fireEvent.click(openBtn);

    expect(screen.getByText('Tambah Komitmen & Vault')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Tutup modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Tambah Komitmen & Vault')).not.toBeInTheDocument();
  });

  it('opens and closes SimulatePurchaseModal from navbar quick action', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Rp 100.000/i)).toBeInTheDocument();
    });

    const openBtn = screen.getByRole('button', { name: /Simulasi Belanja/i });
    fireEvent.click(openBtn);

    expect(screen.getByText('Simulasi Rencana Belanja')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Tutup modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Simulasi Rencana Belanja')).not.toBeInTheDocument();
  });

  it('displays user profile in navbar and invokes logout on Keluar click', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    });
    expect(screen.getByText('BS')).toBeInTheDocument();

    const logoutBtn = screen.getByRole('button', { name: /Keluar/i });
    fireEvent.click(logoutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('opens EditTransactionModal when clicking edit on a transaction and closes cleanly', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/categories') return [];
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Makan Siang Soto Ayam/i)).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: /Edit transaksi/i });
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit Transaksi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Makan Siang Soto Ayam')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Tutup modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Edit Transaksi')).not.toBeInTheDocument();
  });
});

describe('App Component Auth Gating', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading spinner when auth is loading', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText(/Memuat sesi Rezekify\.\.\./i)).toBeInTheDocument();
  });

  it('renders AuthPage when user is not authenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    expect(screen.getByRole('button', { name: /Masuk \(Login\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daftar Akun/i })).toBeInTheDocument();
  });

  it('renders DashboardPage when user is authenticated', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(null);
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1', email: 'a@b.com', full_name: 'Alex' },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText(/Rezekify/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Deterministic Runway/i)).toBeInTheDocument();
    });
  });
});
