import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpenseCharts } from '../components/ExpenseCharts';
import * as apiClient from '../services/apiClient';

describe('ExpenseCharts Component', () => {
  const mockDailyData = {
    period: 'daily' as const,
    daily_safe_runway: 70000,
    total_spent_in_period: 215000,
    items: [
      { date: '2026-09-13', day_label: 'Min', amount: 35000, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-14', day_label: 'Sen', amount: 45000, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-15', day_label: 'Sel', amount: 0, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-16', day_label: 'Rab', amount: 25000, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-17', day_label: 'Kam', amount: 85000, safe_runway_threshold: 70000, is_over_budget: true },
      { date: '2026-09-18', day_label: 'Jum', amount: 0, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-19', day_label: 'Sab', amount: 25000, safe_runway_threshold: 70000, is_over_budget: false },
    ],
  };

  const mockMonthlyData = {
    period: 'monthly' as const,
    cycle_start_date: '2026-09-01',
    cycle_end_date: '2026-09-19',
    total_spent: 400000,
    items: [
      { category_id: 'cat-1', category_name: 'Makanan & Minuman', amount: 300000, percentage: 75.0, color: '#6366f1' },
      { category_id: 'cat-2', category_name: 'Transportasi', amount: 100000, percentage: 25.0, color: '#0ea5e9' },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and renders daily spending breakdown with animated bars', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    render(<ExpenseCharts />);

    await waitFor(() => {
      expect(screen.getByText('Min')).toBeInTheDocument();
      expect(screen.getByText('Kam')).toBeInTheDocument();
      expect(screen.getByText('Sab')).toBeInTheDocument();
    });
  });

  it('renders Safe Runway Threshold Baseline and interactive tooltip data correctly', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    render(<ExpenseCharts />);

    await waitFor(() => {
      expect(screen.getByText(/Batas Aman: Rp 70\.000/i)).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /Grafik pengeluaran 7 hari terakhir vs ambang batas aman runway/i })).toBeInTheDocument();
      expect(screen.getByText(/Melebihi Jatah \(\+Rp 15\.000\)/i)).toBeInTheDocument();
      expect(screen.getAllByText('Sesuai Jatah').length).toBeGreaterThan(0);
    });
  });

  it('switches to monthly breakdown when period button is clicked', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('period=monthly')) return mockMonthlyData;
      return mockDailyData;
    });

    render(<ExpenseCharts />);

    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.getByText('Makanan & Minuman')).toBeInTheDocument();
      expect(screen.getByText(/Rp 300\.000/i)).toBeInTheDocument();
      expect(screen.getByText(/75%/i)).toBeInTheDocument();
      expect(screen.getByText('Transportasi')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { name: /Makanan & Minuman: 75%/i })).toBeInTheDocument();
    });
  });

  it('renders accessible empty state when items list is empty', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      period: 'monthly' as const,
      cycle_start_date: '2026-09-01',
      cycle_end_date: '2026-09-19',
      total_spent: 0,
      items: [],
    });

    render(<ExpenseCharts />);
    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Belum Ada Pengeluaran Tercatat/i)).toBeInTheDocument();
    });
  });

  it('re-fetches analytics data when refreshTrigger prop updates', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    const { rerender } = render(<ExpenseCharts refreshTrigger={0} />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    rerender(<ExpenseCharts refreshTrigger={1} />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
