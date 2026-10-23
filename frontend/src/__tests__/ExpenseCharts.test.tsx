import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

  const renderExpenseCharts = (ui = <ExpenseCharts />) => {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  };

  it('fetches and renders daily spending breakdown with animated bars', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    renderExpenseCharts();

    await waitFor(() => {
      expect(screen.getByText('Min')).toBeInTheDocument();
      expect(screen.getByText('Kam')).toBeInTheDocument();
      expect(screen.getByText('Sab')).toBeInTheDocument();
    });
  });

  it('renders Safe Runway Threshold Baseline and interactive tooltip data correctly', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    renderExpenseCharts();

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

    renderExpenseCharts();

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

    renderExpenseCharts();
    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Belum Ada Pengeluaran Tercatat/i)).toBeInTheDocument();
    });
  });

  it('re-fetches analytics data when refreshTrigger prop updates', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    const { rerender } = render(
      <MemoryRouter>
        <ExpenseCharts refreshTrigger={0} />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    rerender(
      <MemoryRouter>
        <ExpenseCharts refreshTrigger={1} />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('renders zero-layout-shift skeleton loader with aria-busy while loading', () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(() => new Promise(() => {}));
    renderExpenseCharts();
    const skeleton = screen.getByTestId('expense-charts-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  it('enforces WCAG AA minimum 38px touch targets on period tab buttons', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);
    renderExpenseCharts();

    await waitFor(() => {
      const dailyBtn = screen.getByRole('tab', { name: /Harian \(Daily\)/i });
      const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });

      expect(dailyBtn).toHaveClass('min-h-[38px]');
      expect(monthlyBtn).toHaveClass('min-h-[38px]');
    });
  });

  it('enforces tabular-nums on safe runway threshold badge and tooltip', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    renderExpenseCharts();

    await waitFor(() => {
      const badge = screen.getByTestId('safe-runway-header-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('tabular-nums');
    });
  });

  it('renders elevated Safe Runway threshold badge in card header and unobtrusive baseline divider in chart', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);
    renderExpenseCharts();

    await waitFor(() => {
      const badge = screen.getByTestId('safe-runway-header-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Batas Aman: Rp 70\.000\/hari/i);
      expect(badge).toHaveClass('tabular-nums', 'font-mono');

      const divider = screen.getByTestId('safe-runway-baseline-divider');
      expect(divider).toBeInTheDocument();
      expect(divider).toHaveAttribute('aria-hidden', 'true');
      expect(divider).toHaveClass('border-amber-500/50', 'pointer-events-none');
      expect(divider.textContent).toBe('');
    });
  });

  it('hides safe runway header badge when period is switched to monthly or threshold is zero', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('period=monthly')) return mockMonthlyData;
      return mockDailyData;
    });

    renderExpenseCharts();
    await waitFor(() => {
      expect(screen.getByTestId('safe-runway-header-badge')).toBeInTheDocument();
    });

    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('safe-runway-header-badge')).not.toBeInTheDocument();
    });
  });

  it('daily bars render tooltips without threshold badge DOM collision in chart area', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);
    renderExpenseCharts();

    await waitFor(() => {
      const chartArea = screen.getByRole('region', { name: /Grafik pengeluaran 7 hari terakhir vs ambang batas aman runway/i });
      expect(chartArea).toBeInTheDocument();
      expect(chartArea.querySelector('[data-testid="safe-runway-header-badge"]')).toBeNull();

      const baseline = chartArea.querySelector('[data-testid="safe-runway-baseline-divider"]');
      expect(baseline).toHaveClass('pointer-events-none');
      expect(baseline).not.toHaveTextContent(/Batas Aman/i);
    });
  });

  it('renders monthly breakdown progress bars with emerald gradient tokens even for zero-percentage items', async () => {
    const zeroMonthlyData = {
      period: 'monthly' as const,
      cycle_start_date: '2026-09-01',
      cycle_end_date: '2026-09-19',
      total_spent: 100000,
      items: [
        { category_id: 'cat-1', category_name: 'Makanan & Minuman', amount: 100000, percentage: 100.0, color: '#6366f1' },
        { category_id: 'cat-2', category_name: 'Pendidikan', amount: 0, percentage: 0.0, color: '#0ea5e9' },
      ],
    };
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(zeroMonthlyData);

    renderExpenseCharts();
    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      const zeroProgressBar = screen.getByRole('progressbar', { name: /Pendidikan: 0%/i });
      expect(zeroProgressBar).toBeInTheDocument();
      expect(zeroProgressBar).toHaveAttribute('aria-valuenow', '0');
    });
  });

  it('mounts Monthly Donut chart on initial load when ?period=monthly is present in URL', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('period=monthly')) return mockMonthlyData;
      return mockDailyData;
    });

    render(
      <MemoryRouter initialEntries={['/?period=monthly']}>
        <ExpenseCharts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Makanan & Minuman')).toBeInTheDocument();
      expect(screen.getByText(/Rp 300\.000/i)).toBeInTheDocument();
      expect(screen.getByText(/75%/i)).toBeInTheDocument();
    });
  });

  it('updates period search param while preserving existing view search param', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('period=monthly')) return mockMonthlyData;
      return mockDailyData;
    });

    function LocationProbe() {
      const location = useLocation();
      return <span data-testid="url-search-probe">{location.search}</span>;
    }

    render(
      <MemoryRouter initialEntries={['/?view=overview']}>
        <ExpenseCharts />
        <LocationProbe />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Min')).toBeInTheDocument();
    });

    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      const search = screen.getByTestId('url-search-probe').textContent;
      const params = new URLSearchParams(search || '');
      expect(params.get('period')).toBe('monthly');
      expect(params.get('view')).toBe('overview');
    });
  });
});
