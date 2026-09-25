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

    vi.spyOn(apiClient, 'getTransactions').mockImplementation(async () => {
      const res = await apiClient.apiFetch('/transactions');
      if (Array.isArray(res)) {
        return {
          items: res,
          total: res.length,
          page: 1,
          page_size: 20,
          total_pages: 1,
        };
      }
      return res as any;
    });
  });

  it('renders dashboard with navigation shell and overview cockpit', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 25000, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    expect(screen.getAllByText(/Rezekify/i)[0]).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/DAILY SAFE RUNWAY/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Rp 100\.000/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Internet & WiFi/i)).toBeInTheDocument();
    });
  });

  it('switches views between Ringkasan, Buku Besar, and Vaults', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/vaults') return [];
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('DAILY SAFE RUNWAY')).toBeInTheDocument();
    });

    // Switch to Buku Besar
    const ledgerNavBtn = screen.getAllByRole('button', { name: /Buku Besar/i })[0];
    fireEvent.click(ledgerNavBtn);

    await waitFor(() => {
      expect(screen.getByText('Buku Besar (Ledger)')).toBeInTheDocument();
      expect(screen.getAllByText(/Makan Siang Soto Ayam/i)[0]).toBeInTheDocument();
    });

    // Switch to Komitmen & Vaults
    const vaultsNavBtn = screen.getByRole('button', { name: /Komitmen & Vaults/i });
    fireEvent.click(vaultsNavBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Tambah Vault/i })).toBeInTheDocument();
    });
  });

  it('handles text submission via QuickCaptureBar to /dashboard/ai-chat', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
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

    const input = screen.getByPlaceholderText(/Ketik mutasi/i);
    fireEvent.change(input, { target: { value: 'beli bensin 35rb bca' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Berhasil mencatat pengeluaran bensin Rp 35.000/i)).toBeInTheDocument();
    });
  });

  it('opens and closes AccountModal from sidebar + Rekening action', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 0, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('DAILY SAFE RUNWAY')).toBeInTheDocument();
    });

    const openBtn = screen.getByRole('button', { name: /\+ Rekening/i });
    fireEvent.click(openBtn);

    await waitFor(() => {
      expect(screen.getByText('Tambah Akun Baru')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /Tutup modal/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Tambah Akun Baru')).not.toBeInTheDocument();
    });
  });

  it('opens SettingsModal from sidebar Pengaturan button', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint.startsWith('/transactions')) return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/categories') return [];
      if (endpoint === '/vaults') return [];
      if (endpoint === '/settings') {
        return {
          telegram: { is_connected: false, telegram_chat_id: null, bot_username: 'RezekifyBot' },
          ai: {
            is_custom_ai_enabled: false,
            provider: 'SYSTEM',
            model: 'gemini-2.5-flash',
            has_api_key: false,
            available_models: {},
          },
        };
      }
      return {};
    });

    render(<DashboardPage />);

    const settingsBtn = screen.getAllByRole('button', { name: /Pengaturan/i })[0];
    fireEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText('Pengaturan Akun & Sistem')).toBeInTheDocument();
    });
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
    });
  });
});
