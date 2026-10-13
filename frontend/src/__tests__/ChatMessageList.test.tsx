import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatMessageList } from '../components/ChatMessageList';
import { ChatMessageItem } from '../types/api';

describe('ChatMessageList Component', () => {
  it('renders welcome empty state with quick prompt chips when messages is empty', () => {
    const onSelectPrompt = vi.fn();
    render(
      <ChatMessageList
        messages={[]}
        onCancelTransaction={vi.fn()}
        onSelectPrompt={onSelectPrompt}
      />
    );

    expect(screen.getByText('Asisten Finansial AI')).toBeInTheDocument();
    expect(screen.getByText('Contoh Pertanyaan Cepat')).toBeInTheDocument();

    const promptBtn = screen.getByText('Berapa saldo bebas saya hari ini?');
    fireEvent.click(promptBtn);
    expect(onSelectPrompt).toHaveBeenCalledWith('Berapa saldo bebas saya hari ini?');
  });

  it('renders loading skeleton when isHistoryLoading is true', () => {
    render(
      <ChatMessageList
        messages={[]}
        isHistoryLoading={true}
        onCancelTransaction={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Memuat riwayat percakapan/i)).toBeInTheDocument();
    expect(screen.queryByText('Asisten Finansial AI')).not.toBeInTheDocument();
  });

  it('renders user and assistant messages with timestamps', () => {
    const messages: ChatMessageItem[] = [
      {
        id: '1',
        role: 'user',
        content: 'Halo AI, apa kabar?',
        created_at: '2026-09-29T10:30:00Z',
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Halo! Saya siap membantu mengatur keuangan Anda.',
        created_at: '2026-09-29T10:30:05Z',
      },
    ];

    render(
      <ChatMessageList
        messages={messages}
        onCancelTransaction={vi.fn()}
      />
    );

    expect(screen.getByText('Halo AI, apa kabar?')).toBeInTheDocument();
    expect(screen.getByText('Halo! Saya siap membantu mengatur keuangan Anda.')).toBeInTheDocument();
  });

  it('renders transaction card when assistant message includes transaction', () => {
    const messages: ChatMessageItem[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Transaksi dicatat.',
        transaction: {
          id: 'tx-100',
          amount: 50000,
          account_name: 'BCA',
          category_name: 'Makan',
          description: 'Ayam Geprek',
          type: 'EXPENSE',
          account_balance_after: 250000,
        },
        created_at: '2026-09-29T12:00:00Z',
      },
    ];

    const onCancelTransaction = vi.fn();
    const onViewLedger = vi.fn();

    render(
      <ChatMessageList
        messages={messages}
        onCancelTransaction={onCancelTransaction}
        onViewLedger={onViewLedger}
      />
    );

    expect(screen.getByText('Ayam Geprek')).toBeInTheDocument();
    expect(screen.getByText('BCA')).toBeInTheDocument();
    expect(screen.getByText('Makan')).toBeInTheDocument();
  });

  it('renders thinking/typing indicator when isAiLoading is true', () => {
    render(
      <ChatMessageList
        messages={[]}
        isAiLoading={true}
        onCancelTransaction={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Sedang mengetik...')).toBeInTheDocument();
    expect(screen.getByText('Sedang menganalisis...')).toBeInTheDocument();
  });

  it('allows text selection and renders inline copy button on assistant messages', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const messages: ChatMessageItem[] = [
      {
        id: 'msg-asst-1',
        role: 'assistant',
        content: 'Teks tanggapan yang bisa disalin.',
        created_at: '2026-10-14T10:00:00Z',
      },
    ];

    render(
      <ChatMessageList
        messages={messages}
        onCancelTransaction={vi.fn()}
      />
    );

    const logContainer = screen.getByRole('log');
    expect(logContainer).not.toHaveClass('select-none');

    const bubble = screen.getByText('Teks tanggapan yang bisa disalin.');
    expect(bubble).toHaveClass('select-text');

    const copyBtn = screen.getByRole('button', { name: /salin teks tanggapan/i });
    expect(copyBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(copyBtn);
    });
    expect(writeTextMock).toHaveBeenCalledWith('Teks tanggapan yang bisa disalin.');
    expect(screen.getByText('Tersalin')).toBeInTheDocument();
  });

  it('renders Chain of Thought accordion collapsed by default and reveals traces on toggle', () => {
    const messages: ChatMessageItem[] = [
      {
        id: 'msg-trace-1',
        role: 'assistant',
        content: 'Saldo operasional Anda adalah Rp 5.000.000.',
        metadata: {
          thought: 'Menganalisis jatah runway aman pengguna',
          traces: [
            {
              hop: 1,
              thought: 'Cek telemetry terkini',
              tool_name: 'get_runway_telemetry',
              tool_args: {},
              observation: { operational_free_cash: 5000000, daily_safe_runway: 150000 },
            },
          ],
        },
        created_at: '2026-10-14T10:05:00Z',
      },
    ];

    render(
      <ChatMessageList
        messages={messages}
        onCancelTransaction={vi.fn()}
      />
    );

    // Accordion button exists with correct count
    const accordionBtn = screen.getByRole('button', {
      name: /💭 Proses Berpikir & Aktivitas \(1 langkah\)/i,
    });
    expect(accordionBtn).toBeInTheDocument();
    expect(accordionBtn).toHaveAttribute('aria-expanded', 'false');

    // Content is collapsed initially
    expect(screen.queryByText(/Menganalisis jatah runway aman pengguna/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/get_runway_telemetry/i)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(accordionBtn);
    expect(accordionBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/"Menganalisis jatah runway aman pengguna"/i)).toBeInTheDocument();
    expect(screen.getByText('get_runway_telemetry')).toBeInTheDocument();
    expect(screen.getByText(/Langkah 1/i)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(accordionBtn);
    expect(accordionBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Menganalisis jatah runway aman pengguna/i)).not.toBeInTheDocument();
  });
});
