import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardPage } from '../pages/DashboardPage';
import * as apiClient from '../services/apiClient';

describe('DashboardPage Component', () => {
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
});
