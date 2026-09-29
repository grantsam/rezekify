import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIChatView } from '../components/AIChatView';
import * as apiClient from '../services/apiClient';

vi.mock('../services/apiClient', async () => {
  const actual = await vi.importActual('../services/apiClient');
  return {
    ...actual,
    getChatMessages: vi.fn(),
    clearChatMessages: vi.fn(),
    submitChatMessage: vi.fn(),
    submitChatReceipt: vi.fn(),
    submitChatVoice: vi.fn(),
    deleteTransaction: vi.fn(),
  };
});

describe('AIChatView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders chat message history on mount', async () => {
    vi.mocked(apiClient.getChatMessages).mockResolvedValue([
      { id: '1', role: 'user', content: 'makan siang 35rb', created_at: new Date().toISOString() },
      { id: '2', role: 'assistant', content: '✅ Tercatat: Rp 35,000', created_at: new Date().toISOString() },
    ]);

    render(<AIChatView onNavigateToLedger={vi.fn()} onDataMutated={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('makan siang 35rb')).toBeInTheDocument();
      expect(screen.getByText('✅ Tercatat: Rp 35,000')).toBeInTheDocument();
    });
  });

  it('submits a new message, updates feed and telemetry', async () => {
    vi.mocked(apiClient.getChatMessages).mockResolvedValue([]);
    vi.mocked(apiClient.submitChatMessage).mockResolvedValue({
      reply: '✅ Berhasil dicatat: Kopi 20rb',
      message_id: 'new-msg-1',
      transaction: {
        id: 'tx-999',
        amount: 20000,
        account_name: 'BCA',
        category_name: 'Minuman',
        description: 'Kopi',
        type: 'EXPENSE',
        account_balance_after: 80000,
      },
      telemetry: {
        operational_free_cash: 500000,
        daily_safe_runway: 50000,
        days_remaining: 10,
        health_status: 'HEALTHY',
      },
    });

    const onDataMutated = vi.fn();
    render(<AIChatView onNavigateToLedger={vi.fn()} onDataMutated={onDataMutated} />);

    const textarea = screen.getByPlaceholderText(/tanya atau catat keuangan/i);
    fireEvent.change(textarea, { target: { value: 'kopi 20rb bca' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(apiClient.submitChatMessage).toHaveBeenCalledWith('kopi 20rb bca');
      expect(screen.getByText('✅ Berhasil dicatat: Kopi 20rb')).toBeInTheDocument();
      expect(onDataMutated).toHaveBeenCalled();
    });
  });

  it('handles clearing chat history', async () => {
    vi.mocked(apiClient.getChatMessages).mockResolvedValue([
      { id: '1', role: 'user', content: 'pesan lama', created_at: new Date().toISOString() },
    ]);
    vi.mocked(apiClient.clearChatMessages).mockResolvedValue({ status: 'cleared' });

    render(<AIChatView onNavigateToLedger={vi.fn()} onDataMutated={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('pesan lama')).toBeInTheDocument();
    });

    const resetBtn = screen.getByRole('button', { name: /bersihkan riwayat/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(apiClient.clearChatMessages).toHaveBeenCalled();
      expect(screen.queryByText('pesan lama')).not.toBeInTheDocument();
    });
  });

  it('submits a receipt image file successfully', async () => {
    vi.mocked(apiClient.getChatMessages).mockResolvedValue([]);
    vi.mocked(apiClient.submitChatReceipt).mockResolvedValue({
      reply: 'Struk bensin Rp 50.000 berhasil diekstrak',
      transaction: {
        id: 'tx-receipt-1',
        amount: 50000,
        account_name: 'Cash',
        category_name: 'Bensin',
        description: 'Pertamax',
        type: 'EXPENSE',
      },
    });

    const onDataMutated = vi.fn();
    render(<AIChatView onNavigateToLedger={vi.fn()} onDataMutated={onDataMutated} />);

    const file = new File(['dummy receipt content'], 'receipt.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const textarea = screen.getByPlaceholderText(/tanya atau catat keuangan/i);
    fireEvent.change(textarea, { target: { value: 'tolong catat ini' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(apiClient.submitChatReceipt).toHaveBeenCalledWith(file, 'tolong catat ini');
      expect(screen.getByText('Struk bensin Rp 50.000 berhasil diekstrak')).toBeInTheDocument();
      expect(onDataMutated).toHaveBeenCalled();
    });
  });

  it('cancels a recorded transaction from card and triggers mutation', async () => {
    vi.mocked(apiClient.getChatMessages).mockResolvedValue([
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Berhasil dicatat',
        transaction: {
          id: 'tx-to-cancel-1',
          amount: 35000,
          account_name: 'BCA',
          category_name: 'Makan',
          description: 'Nasi Padang',
          type: 'EXPENSE',
        },
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(apiClient.deleteTransaction).mockResolvedValue({ detail: 'deleted' });

    const onDataMutated = vi.fn();
    render(<AIChatView onNavigateToLedger={vi.fn()} onDataMutated={onDataMutated} />);

    await waitFor(() => {
      expect(screen.getByText('Nasi Padang')).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', { name: /batalkan transaksi/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(apiClient.deleteTransaction).toHaveBeenCalledWith('tx-to-cancel-1');
      expect(onDataMutated).toHaveBeenCalled();
      expect(screen.getByText('Dibatalkan')).toBeInTheDocument();
    });
  });

  it('navigates to ledger when clicking View Ledger button', async () => {
    vi.mocked(apiClient.getChatMessages).mockResolvedValue([
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Tercatat',
        transaction: {
          id: 'tx-view-1',
          amount: 15000,
          account_name: 'BCA',
          category_name: 'Kopi',
          description: 'Kopi Kenangan',
          type: 'EXPENSE',
        },
        created_at: new Date().toISOString(),
      },
    ]);

    const onNavigateToLedger = vi.fn();
    render(<AIChatView onNavigateToLedger={onNavigateToLedger} onDataMutated={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Kopi Kenangan')).toBeInTheDocument();
    });

    const viewLedgerBtn = screen.getByRole('button', { name: /buka di buku besar/i });
    fireEvent.click(viewLedgerBtn);

    expect(onNavigateToLedger).toHaveBeenCalledTimes(1);
  });

  it('displays error message when message submission fails', async () => {
    vi.mocked(apiClient.getChatMessages).mockResolvedValue([]);
    vi.mocked(apiClient.submitChatMessage).mockRejectedValue(new Error('Network error 500'));

    render(<AIChatView onNavigateToLedger={vi.fn()} onDataMutated={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/tanya atau catat keuangan/i);
    fireEvent.change(textarea, { target: { value: 'catat gagal' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText(/gagal memproses permintaan/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error 500/i)).toBeInTheDocument();
    });
  });

  it('selects quick prompt chip when chat history is empty', async () => {
    vi.mocked(apiClient.getChatMessages).mockResolvedValue([]);

    render(<AIChatView onNavigateToLedger={vi.fn()} onDataMutated={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Contoh Pertanyaan Cepat')).toBeInTheDocument();
    });

    const promptBtn = screen.getByText('Berapa saldo bebas saya hari ini?');
    fireEvent.click(promptBtn);

    const textarea = screen.getByPlaceholderText(/tanya atau catat keuangan/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Berapa saldo bebas saya hari ini?');
  });
});
