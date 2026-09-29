import { render, screen, fireEvent } from '@testing-library/react';
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
});
