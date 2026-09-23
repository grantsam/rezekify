import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UpcomingBillsCard } from '../components/UpcomingBillsCard';

describe('UpcomingBillsCard Component', () => {
  it('renders upcoming bill warning when bills due within 7 days exist with calm badge for >3 days', () => {
    const mockBills = [
      {
        name: 'Sewa Kos',
        target_amount: 1500000,
        allocated_amount: 500000,
        target_date: '2026-09-23',
        days_until_due: 5,
      },
    ];
    render(<UpcomingBillsCard bills={mockBills} />);
    expect(screen.getByText(/Sewa Kos/i)).toBeInTheDocument();
    expect(screen.getByText(/5 hari lagi/i)).toBeInTheDocument();
    expect(screen.getByText(/Kurang Rp 1.000.000/i)).toBeInTheDocument();
    expect(screen.getByText('H-5')).toBeInTheDocument();
  });

  it('renders high-priority urgency badge with pulsing dot when days_until_due <= 3', () => {
    const mockBills = [
      {
        name: 'Listrik & Air',
        target_amount: 500000,
        allocated_amount: 200000,
        target_date: '2026-09-21',
        days_until_due: 2,
      },
    ];
    render(<UpcomingBillsCard bills={mockBills} />);
    expect(screen.getByText(/Listrik & Air/i)).toBeInTheDocument();
    expect(screen.getByText(/2 hari lagi/i)).toBeInTheDocument();
    const badge = screen.getByText('H-2');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-rose-300');
    expect(badge.className).toContain('bg-rose-500/20');
  });

  it('renders skeleton loader when isLoading is true', () => {
    render(<UpcomingBillsCard isLoading={true} />);
    const skeleton = screen.getByTestId('upcoming-bills-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  it('renders nothing when bills list is empty', () => {
    const { container } = render(<UpcomingBillsCard bills={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
