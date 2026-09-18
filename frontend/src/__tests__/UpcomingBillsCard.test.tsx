import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UpcomingBillsCard } from '../components/UpcomingBillsCard';

describe('UpcomingBillsCard Component', () => {
  it('renders upcoming bill warning when bills due within 7 days exist', () => {
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
  });

  it('renders nothing when bills list is empty', () => {
    const { container } = render(<UpcomingBillsCard bills={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
