import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpenseCharts, PALETTE, resolveCategoryColor } from '../components/ExpenseCharts';
import * as apiClient from '../services/apiClient';

describe('ExpenseCharts Living SVG & Stability', () => {
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
      { category_id: 'cat-1', category_name: 'Makanan & Minuman', amount: 300000, percentage: 75.0, color: '#10B981' },
      { category_id: 'cat-2', category_name: 'Transportasi', amount: 100000, percentage: 25.0, color: '#06B6D4' },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('locks container height at min-h-[380px] with flex flex-col justify-between', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    const { container } = render(<ExpenseCharts />);
    await waitFor(() => {
      expect(screen.getByText('Min')).toBeInTheDocument();
    });

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('min-h-[380px]');
    expect(card.className).toContain('flex');
    expect(card.className).toContain('flex-col');
    expect(card.className).toContain('justify-between');
  });

  it('renders Daily View with SVG curved area wave, dailyAreaGradient, Y-axis gridlines, and baseline divider', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    const { container } = render(<ExpenseCharts />);

    await waitFor(() => {
      expect(screen.getByText('Min')).toBeInTheDocument();
    });

    // SVG elements
    const svg = container.querySelector('svg[viewBox="0 0 560 160"]');
    expect(svg).toBeInTheDocument();

    const gradient = container.querySelector('linearGradient#dailyAreaGradient');
    expect(gradient).toBeInTheDocument();

    // Area path filled with dailyAreaGradient
    const areaPath = container.querySelector('path[fill="url(#dailyAreaGradient)"]');
    expect(areaPath).toBeInTheDocument();

    // Baseline divider preserved
    const divider = screen.getByTestId('safe-runway-baseline-divider');
    expect(divider).toBeInTheDocument();

    // Safe runway header badge preserved
    const badge = screen.getByTestId('safe-runway-header-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/Batas Aman: Rp 70\.000/i);

    // Y-axis ticks present
    expect(screen.getByText('Rp 0')).toBeInTheDocument();

    // Legend present
    expect(screen.getByText('Sesuai Jatah')).toBeInTheDocument();
    expect(screen.getByText('Melebihi Jatah')).toBeInTheDocument();
  });

  it('renders interactive hover beacon and floating details when hovering daily data points', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    const { container } = render(<ExpenseCharts />);

    await waitFor(() => {
      expect(screen.getByText('Min')).toBeInTheDocument();
    });

    // Find triggerable hover point or chart container
    const chartArea = screen.getByRole('region', { name: /Grafik pengeluaran 7 hari terakhir/i });
    expect(chartArea).toBeInTheDocument();

    // Trigger mouse enter on a day point
    const dayNode = container.querySelector('[data-testid="chart-node-4"]'); // Kam (85000)
    expect(dayNode).toBeInTheDocument();
    if (dayNode) {
      fireEvent.mouseEnter(dayNode);
    }

    await waitFor(() => {
      expect(container.querySelector('[data-testid="living-chart-beacon"]')).toBeInTheDocument();
      expect(screen.getAllByText(/Rp 85\.000/i).length).toBeGreaterThan(0);
    });
  });

  it('renders Monthly View with SVG Donut Ring and category ribbons breakdown', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockMonthlyData);

    const { container } = render(<ExpenseCharts />);
    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.getByText('Makanan & Minuman')).toBeInTheDocument();
    });

    // Donut SVG
    const donutSvg = container.querySelector('svg[viewBox="0 0 160 160"]');
    expect(donutSvg).toBeInTheDocument();

    // Center total text
    expect(screen.getByText(/Total/i)).toBeInTheDocument();
    expect(screen.getByText(/400rb|400\.000/i)).toBeInTheDocument();

    // Category items
    expect(screen.getByText('Transportasi')).toBeInTheDocument();
    expect(screen.getByText(/75%/i)).toBeInTheDocument();
    expect(screen.getByText(/25%/i)).toBeInTheDocument();
    expect(screen.getByText(/Rp 300\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/Rp 100\.000/i)).toBeInTheDocument();
  });

  it('keeps container min-h-[380px] stable across tab toggles', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('period=monthly')) return mockMonthlyData;
      return mockDailyData;
    });

    const { container } = render(<ExpenseCharts />);
    await waitFor(() => {
      expect(screen.getByText('Min')).toBeInTheDocument();
    });

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('min-h-[380px]');

    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.getByText('Makanan & Minuman')).toBeInTheDocument();
    });
    expect(card.className).toContain('min-h-[380px]');

    const dailyBtn = screen.getByRole('tab', { name: /Harian \(Daily\)/i });
    fireEvent.click(dailyBtn);

    await waitFor(() => {
      expect(screen.getByText('Min')).toBeInTheDocument();
    });
    expect(card.className).toContain('min-h-[380px]');
  });

  it('decouples backend fallback #64748b to vibrant PALETTE colors in monthly donut and legend', async () => {
    const mockSlateData = {
      period: 'monthly' as const,
      cycle_start_date: '2026-09-01',
      cycle_end_date: '2026-09-19',
      total_spent: 500000,
      items: [
        { category_id: 'c1', category_name: 'Makan', amount: 300000, percentage: 60.0, color: '#64748b' },
        { category_id: 'c2', category_name: 'Transport', amount: 200000, percentage: 40.0, color: '#64748B' },
      ],
    };

    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockSlateData);

    const { container } = render(<ExpenseCharts />);
    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.getByText('Makan')).toBeInTheDocument();
    });

    const circles = container.querySelectorAll('svg[viewBox="0 0 160 160"] circle[stroke]');
    const arcCircles = Array.from(circles).filter((c) => c.getAttribute('stroke') !== 'currentColor');
    expect(arcCircles.length).toBe(2);

    expect(arcCircles[0].getAttribute('stroke')?.toLowerCase()).not.toBe('#64748b');
    expect(arcCircles[1].getAttribute('stroke')?.toLowerCase()).not.toBe('#64748b');
    expect(arcCircles[0].getAttribute('stroke')?.toLowerCase()).toBe(PALETTE[0].toLowerCase());
    expect(arcCircles[1].getAttribute('stroke')?.toLowerCase()).toBe(PALETTE[1].toLowerCase());

    expect(resolveCategoryColor('#64748b', 0)).toBe(PALETTE[0]);
    expect(resolveCategoryColor('#64748B', 1)).toBe(PALETTE[1]);
    expect(resolveCategoryColor(null, 2)).toBe(PALETTE[2]);
    expect(resolveCategoryColor(undefined, 3)).toBe(PALETTE[3]);
    expect(resolveCategoryColor('#FF0000', 0)).toBe('#FF0000');
  });

  it('sanitizes SVG curve coordinates when daily items contain only 1 item or 0 expenses', async () => {
    const singleItemDaily = {
      period: 'daily' as const,
      daily_safe_runway: 50000,
      total_spent_in_period: 10000,
      items: [
        { date: '2026-09-19', day_label: 'Sab', amount: 10000, safe_runway_threshold: 50000, is_over_budget: false },
      ],
    };

    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(singleItemDaily);

    const { container } = render(<ExpenseCharts />);

    await waitFor(() => {
      expect(screen.getByText('Sab')).toBeInTheDocument();
    });

    const paths = container.querySelectorAll('svg[viewBox="0 0 560 160"] path');
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((p) => {
      const d = p.getAttribute('d') || '';
      expect(d).not.toBe('');
      expect(d).not.toContain('NaN');
      expect(d).not.toContain('Infinity');
    });
  });
});
