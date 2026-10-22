import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TransactionsTable } from '../components/TransactionsTable';
import { Account, Category, Transaction, Vault } from '../types/api';

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

  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK', current_balance: 1000000, is_active: true },
    { id: 'acc-2', name: 'Dompet Cash', account_type: 'CASH', current_balance: 50000, is_active: true },
  ];

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Makanan', category_type: 'EXPENSE' },
    { id: 'cat-2', name: 'Transportasi', category_type: 'EXPENSE' },
  ];

  const mockVaults: Vault[] = [
    {
      id: 'vault-1',
      name: 'Wifi Indihome',
      vault_type: 'FIXED_BILL',
      target_amount: 350000,
      allocated_amount: 350000,
      target_date: '2026-10-25',
      is_locked: true,
    },
    {
      id: 'vault-2',
      name: 'Dana Darurat',
      vault_type: 'SAVINGS',
      target_amount: 10000000,
      allocated_amount: 2000000,
      is_locked: false,
    },
  ];

  it('renders transactions with description and formatted amount', () => {
    render(<TransactionsTable transactions={mockTransactions} onDelete={vi.fn()} />);

    expect(screen.getAllByText(/Makan Siang Nasi Padang/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Gaji Freelance Web/i)[0]).toBeInTheDocument();
    const expenseEl = screen.getAllByText(/- Rp 35.000/i)[0];
    const incomeEl = screen.getAllByText(/\+ Rp 1.500.000/i)[0];
    expect(expenseEl).toBeInTheDocument();
    expect(expenseEl).toHaveClass('tabular-nums');
    expect(incomeEl).toBeInTheDocument();
    expect(incomeEl).toHaveClass('tabular-nums');

    // Verify semantic table structure
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').length).toBe(3);
    expect(screen.getAllByRole('row').length).toBe(3); // 1 header row + 2 data rows
  });

  it('calls onDelete when delete button is clicked', () => {
    const handleDelete = vi.fn();
    render(<TransactionsTable transactions={mockTransactions} onDelete={handleDelete} />);

    const deleteButtons = screen.getAllByRole('button', { name: /Hapus transaksi/i });
    fireEvent.click(deleteButtons[0]);

    // Confirm deletion in safety modal
    const confirmButton = screen.getByRole('button', { name: /Ya, Hapus/i });
    fireEvent.click(confirmButton);

    expect(handleDelete).toHaveBeenCalledWith('tx-1');
  });

  it('calls onEdit when edit pencil button is clicked', () => {
    const handleEdit = vi.fn();
    render(<TransactionsTable transactions={mockTransactions} onDelete={vi.fn()} onEdit={handleEdit} />);

    const editButtons = screen.getAllByRole('button', { name: /Edit transaksi/i });
    expect(editButtons.length).toBeGreaterThanOrEqual(mockTransactions.length);

    fireEvent.click(editButtons[0]);
    expect(handleEdit).toHaveBeenCalledWith(mockTransactions[0]);
  });

  it('renders empty state when there are no transactions', () => {
    render(<TransactionsTable transactions={[]} onDelete={vi.fn()} />);
    expect(screen.getAllByText(/Belum ada transaksi/i)[0]).toBeInTheDocument();
  });

  it('filters transactions by search query matching description or source_channel', () => {
    render(<TransactionsTable transactions={mockTransactions} onDelete={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Cari transaksi atau channel/i);

    // Search by description
    fireEvent.change(searchInput, { target: { value: 'Nasi Padang' } });
    expect(screen.getAllByText(/Makan Siang Nasi Padang/i)[0]).toBeInTheDocument();
    expect(screen.queryByText(/Gaji Freelance Web/i)).not.toBeInTheDocument();

    // Search by channel
    fireEvent.change(searchInput, { target: { value: 'WEB_MANUAL' } });
    expect(screen.queryByText(/Makan Siang Nasi Padang/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Gaji Freelance Web/i)[0]).toBeInTheDocument();

    // Search not found -> empty state message
    fireEvent.change(searchInput, { target: { value: 'nonexistent-query-xyz' } });
    expect(screen.getAllByText('Tidak ada transaksi yang sesuai dengan filter pencarian.')[0]).toBeInTheDocument();
  });

  it('filters transactions by date buttons', () => {
    const todayIso = new Date().toISOString();
    const tenDaysAgoIso = new Date(Date.now() - 10 * 86400000).toISOString();

    const dateTransactions: Transaction[] = [
      {
        id: 'tx-today',
        description: 'Beli Kopi Hari Ini',
        source_channel: 'WEB_MANUAL',
        transaction_date: todayIso,
        ledger_entries: [{ id: 'le-t', entry_type: 'DEBIT', amount: 25000 }],
      },
      {
        id: 'tx-old',
        description: 'Belanja Lama 10 Hari',
        source_channel: 'TELEGRAM',
        transaction_date: tenDaysAgoIso,
        ledger_entries: [{ id: 'le-o', entry_type: 'DEBIT', amount: 100000 }],
      },
    ];

    render(<TransactionsTable transactions={dateTransactions} onDelete={vi.fn()} />);

    // Default "Semua" shows both
    expect(screen.getAllByText(/Beli Kopi Hari Ini/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Belanja Lama 10 Hari/i)[0]).toBeInTheDocument();

    // Filter "Hari Ini"
    fireEvent.click(screen.getByRole('button', { name: 'Hari Ini' }));
    expect(screen.getAllByText(/Beli Kopi Hari Ini/i)[0]).toBeInTheDocument();
    expect(screen.queryByText(/Belanja Lama 10 Hari/i)).not.toBeInTheDocument();

    // Filter "7 Hari Terakhir"
    fireEvent.click(screen.getByRole('button', { name: '7 Hari Terakhir' }));
    expect(screen.getAllByText(/Beli Kopi Hari Ini/i)[0]).toBeInTheDocument();
    expect(screen.queryByText(/Belanja Lama 10 Hari/i)).not.toBeInTheDocument();

    // Filter "Semua"
    fireEvent.click(screen.getByRole('button', { name: 'Semua' }));
    expect(screen.getAllByText(/Beli Kopi Hari Ini/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Belanja Lama 10 Hari/i)[0]).toBeInTheDocument();
  });

  it('renders Account and Category selector dropdowns', () => {
    render(
      <TransactionsTable
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        onDelete={vi.fn()}
      />
    );

    const accountSelect = screen.getByRole('combobox', { name: /Filter Akun/i });
    const categorySelect = screen.getByRole('combobox', { name: /Filter Kategori/i });

    expect(accountSelect).toBeInTheDocument();
    expect(categorySelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Semua Akun', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'BCA Utama', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Semua Kategori', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Makanan', hidden: true })).toBeInTheDocument();
  });

  it('changing Account selector triggers onParamsChange', () => {
    const handleParamsChange = vi.fn();
    render(
      <TransactionsTable
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        onParamsChange={handleParamsChange}
        onDelete={vi.fn()}
      />
    );

    const accountSelect = screen.getByRole('combobox', { name: /Filter Akun/i });
    fireEvent.click(accountSelect);
    const bcaOption = screen.getByRole('option', { name: 'BCA Utama' });
    fireEvent.click(bcaOption);

    expect(handleParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acc-1',
        page: 1,
      })
    );
  });

  it('changing Category selector triggers onParamsChange', () => {
    const handleParamsChange = vi.fn();
    render(
      <TransactionsTable
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        onParamsChange={handleParamsChange}
        onDelete={vi.fn()}
      />
    );

    const categorySelect = screen.getByRole('combobox', { name: /Filter Kategori/i });
    fireEvent.click(categorySelect);
    const transportOption = screen.getByRole('option', { name: 'Transportasi' });
    fireEvent.click(transportOption);

    expect(handleParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: 'cat-2',
        page: 1,
      })
    );
  });

  it('clicking Previous/Next page triggers onPageChange and onParamsChange', () => {
    const handlePageChange = vi.fn();
    const handleParamsChange = vi.fn();

    render(
      <TransactionsTable
        transactions={mockTransactions}
        total={30}
        page={2}
        pageSize={10}
        totalPages={3}
        onPageChange={handlePageChange}
        onParamsChange={handleParamsChange}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText(/Halaman 2 dari 3 \(30 transaksi\)/i)).toBeInTheDocument();

    const prevButton = screen.getByRole('button', { name: /Sebelumnya/i });
    const nextButton = screen.getByRole('button', { name: /Berikutnya/i });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Click Previous -> goes to page 1
    fireEvent.click(prevButton);
    expect(handlePageChange).toHaveBeenCalledWith(1);
    expect(handleParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
      })
    );

    // Click Next -> goes to page 3
    fireEvent.click(nextButton);
    expect(handlePageChange).toHaveBeenCalledWith(3);
    expect(handleParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 3,
      })
    );
  });

  it('renders category chips when categories are passed', () => {
    const txWithCategory: Transaction[] = [
      {
        id: 'tx-with-cat',
        description: 'Beli Makan Siang Soto',
        source_channel: 'WEB_MANUAL',
        transaction_date: '2026-09-22T12:00:00Z',
        ledger_entries: [
          { id: 'le-cat-1', entry_type: 'DEBIT', amount: 25000, category_id: 'cat-1' },
          { id: 'le-cat-2', entry_type: 'CREDIT', amount: 25000, account_id: 'acc-1' },
        ],
      },
    ];

    render(
      <TransactionsTable
        transactions={txWithCategory}
        categories={mockCategories}
        onDelete={vi.fn()}
      />
    );

    const spans = screen.getAllByText('Makanan').filter((el) => el.tagName.toLowerCase() === 'span');
    expect(spans.length).toBeGreaterThanOrEqual(1);
    expect(spans[0]).toHaveClass('text-[10px]', 'rounded-full');
    expect(spans[0].className).toMatch(/bg-(slate-100|zinc-800)/);
  });

  it('renders mobile card container with data-testid="transactions-mobile-cards"', () => {
    render(<TransactionsTable transactions={mockTransactions} onDelete={vi.fn()} />);

    const mobileCards = screen.getByTestId('transactions-mobile-cards');
    expect(mobileCards).toBeInTheDocument();
    expect(mobileCards).toHaveClass('block', 'sm:hidden', 'divide-y');
  });

  it('debounces onParamsChange by 300ms when user types in search input and immediately fires on clear', () => {
    vi.useFakeTimers();
    const handleParamsChange = vi.fn();

    render(
      <TransactionsTable
        transactions={mockTransactions}
        onParamsChange={handleParamsChange}
        onDelete={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Cari transaksi atau channel/i);

    // Type in search input
    fireEvent.change(searchInput, { target: { value: 'Nasi Padang' } });

    // Should not call immediately
    expect(handleParamsChange).not.toHaveBeenCalled();

    // Fast-forward 200ms -> still not called
    vi.advanceTimersByTime(200);
    expect(handleParamsChange).not.toHaveBeenCalled();

    // Fast-forward another 100ms (total 300ms) -> should be called once
    vi.advanceTimersByTime(100);
    expect(handleParamsChange).toHaveBeenCalledTimes(1);
    expect(handleParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Nasi Padang',
        page: 1,
      })
    );

    // Typing again
    fireEvent.change(searchInput, { target: { value: 'Nasi Padang Rendang' } });
    expect(handleParamsChange).toHaveBeenCalledTimes(1);

    // Clicking clear should immediately cancel timer and call onParamsChange
    const clearButton = screen.getByRole('button', { name: /Hapus pencarian/i });
    fireEvent.click(clearButton);

    expect(handleParamsChange).toHaveBeenCalledTimes(2);
    expect(handleParamsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: undefined,
        page: 1,
      })
    );

    // Advance timers -> should not trigger again
    vi.advanceTimersByTime(500);
    expect(handleParamsChange).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('renders linked vault badge when transaction has vault_id in ledger_entry', () => {
    const txWithVault: Transaction = {
      id: 'tx-1',
      description: 'Bayar Wifi',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-10-22T10:00:00Z',
      ledger_entries: [
        { id: 'le-1', vault_id: 'vault-1', entry_type: 'DEBIT', amount: 350000 },
        { id: 'le-2', account_id: 'acc-1', entry_type: 'CREDIT', amount: 350000 },
      ],
    };

    render(
      <TransactionsTable
        transactions={[txWithVault]}
        onDelete={vi.fn()}
        vaults={mockVaults}
      />
    );

    expect(screen.getAllByText(/Wifi Indihome/i).length).toBeGreaterThan(0);
  });

  it('toolbar container and inputs support responsive fluid wrapping layout on tablet viewports', () => {
    render(
      <TransactionsTable
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        onDelete={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Cari transaksi atau channel/i);
    const searchWrapper = searchInput.parentElement;
    expect(searchWrapper).toHaveClass('min-w-[200px]', 'flex-1');

    const accountSelect = screen.getByTestId('filter-account-select');
    expect(accountSelect.className).toContain('sm:min-w-[160px]');

    const categorySelect = screen.getByTestId('filter-category-select');
    expect(categorySelect.className).toContain('sm:min-w-[160px]');
  });

  it('filter controls and date buttons adhere to accessibility standards and minimum 38px touch targets', () => {
    render(
      <TransactionsTable
        transactions={mockTransactions}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        page={2}
        total={20}
        pageSize={10}
        totalPages={2}
      />
    );

    const dateButtons = screen.getAllByRole('button', { name: /Semua|Hari Ini|7 Hari Terakhir|Bulan Ini/i });
    dateButtons.forEach((btn) => {
      expect(btn).toHaveClass('min-h-[38px]');
    });

    const activeDateBtn = screen.getByRole('button', { name: 'Semua' });
    expect(activeDateBtn).toHaveAttribute('aria-pressed', 'true');
    expect(activeDateBtn).toHaveClass('from-emerald-600', 'to-teal-500');

    const prevBtn = screen.getByRole('button', { name: /Sebelumnya/i });
    const nextBtn = screen.getByRole('button', { name: /Berikutnya/i });
    expect(prevBtn).toHaveClass('min-h-[38px]');
    expect(nextBtn).toHaveClass('min-h-[38px]');

    const editBtns = screen.getAllByRole('button', { name: /Edit transaksi/i });
    const deleteBtns = screen.getAllByRole('button', { name: /Hapus transaksi/i });
    editBtns.forEach((btn) => {
      expect(btn).toHaveClass('min-w-[38px]', 'min-h-[38px]');
    });
    deleteBtns.forEach((btn) => {
      expect(btn).toHaveClass('min-w-[38px]', 'min-h-[38px]');
    });
  });
});
