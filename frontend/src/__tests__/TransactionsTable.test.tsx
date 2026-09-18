import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TransactionsTable } from '../components/TransactionsTable';
import { Transaction } from '../types/api';

describe('TransactionsTable Component', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Makan Siang Nasi Padang',
      source_channel: 'AI_OMNI_INPUT',
      transaction_date: '2026-09-18T12:30:00Z',
      ledger_entries: [
        { id: 'le-1', entry_type: 'DEBIT', amount: 35000 },
        { id: 'le-2', entry_type: 'CREDIT', amount: 35000 },
      ],
    },
    {
      id: 'tx-2',
      description: 'Gaji Freelance Web',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-17T10:00:00Z',
      ledger_entries: [
        { id: 'le-3', entry_type: 'DEBIT', amount: 1500000 },
        { id: 'le-4', entry_type: 'CREDIT', amount: 1500000 },
      ],
    },
  ];

  it('renders transactions with description and formatted amount', () => {
    render(<TransactionsTable transactions={mockTransactions} onDelete={vi.fn()} />);

    expect(screen.getByText(/Makan Siang Nasi Padang/i)).toBeInTheDocument();
    expect(screen.getByText(/Gaji Freelance Web/i)).toBeInTheDocument();
    expect(screen.getByText(/Rp 35.000/i)).toBeInTheDocument();
    expect(screen.getByText(/Rp 1.500.000/i)).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const handleDelete = vi.fn();
    render(<TransactionsTable transactions={mockTransactions} onDelete={handleDelete} />);

    const deleteButtons = screen.getAllByRole('button', { name: /Hapus transaksi/i });
    fireEvent.click(deleteButtons[0]);

    expect(handleDelete).toHaveBeenCalledWith('tx-1');
  });

  it('renders empty state when there are no transactions', () => {
    render(<TransactionsTable transactions={[]} onDelete={vi.fn()} />);
    expect(screen.getByText(/Belum ada transaksi/i)).toBeInTheDocument();
  });
});
