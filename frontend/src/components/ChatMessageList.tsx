import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { ChatMessageItem } from '../types/api';
import { ChatTransactionCard } from './ChatTransactionCard';

export interface ChatMessageListProps {
  messages: ChatMessageItem[];
  isAiLoading?: boolean;
  onCancelTransaction: (transactionId: string) => Promise<void> | void;
  onViewLedger?: () => void;
  onSelectPrompt?: (prompt: string) => void;
}

const DEFAULT_PROMPTS = [
  'Berapa saldo bebas saya hari ini?',
  'Makan siang Padang 35rb pakai BCA',
  'Beli bensin Pertamax 50rb tunai',
  'Gaji bulan ini 10jt masuk Mandiri',
];

const formatTime = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// ponytail: chat message feed with transaction cards and suggested prompt chips; upgrade with message pinning / branching if thread management is added.
export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isAiLoading = false,
  onCancelTransaction,
  onViewLedger,
  onSelectPrompt,
}) => {
  if (messages.length === 0 && !isAiLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
          <Sparkles className="w-6 h-6 text-emerald-400" />
        </div>
        <h3 className="text-base font-semibold text-zinc-100">Asisten Finansial AI</h3>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mt-1 mb-6 leading-relaxed">
          Catat transaksi cepat, foto struk, kirim voice note, atau konsultasikan kondisi arus kas harian Anda.
        </p>

        {onSelectPrompt && (
          <div className="w-full max-w-md space-y-2 text-left">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 block px-1">
              Contoh Pertanyaan Cepat
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEFAULT_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSelectPrompt(prompt)}
                  className="group flex items-center justify-between p-2.5 rounded-xl bg-[#141417] hover:bg-[#1c1c21] border border-zinc-800 hover:border-zinc-700 text-left transition-all active:scale-[0.98] min-h-[42px]"
                >
                  <span className="text-xs text-zinc-300 group-hover:text-zinc-100 line-clamp-2">
                    {prompt}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 shrink-0 ml-2 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const formattedTime = formatTime(msg.created_at);

        if (isUser) {
          return (
            <div key={msg.id} className="flex flex-col items-end">
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-[#1c1c21] border border-zinc-800 px-4 py-2.5 text-sm text-zinc-100 shadow-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.content}
              </div>
              {formattedTime && (
                <span className="text-[10px] text-zinc-500 mt-1 mr-1">{formattedTime}</span>
              )}
            </div>
          );
        }

        return (
          <div key={msg.id} className="flex items-start gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-[85%]">
            <div
              className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5"
              aria-label="AI Assistant"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <div className="rounded-2xl rounded-tl-sm bg-[#141417] border border-zinc-800 px-4 py-2.5 text-sm text-zinc-100 shadow-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.content}
              </div>

              {msg.transaction && (
                <ChatTransactionCard
                  transaction={msg.transaction}
                  onCancel={onCancelTransaction}
                  onViewLedger={onViewLedger}
                />
              )}

              {formattedTime && (
                <span className="text-[10px] text-zinc-500 ml-1">{formattedTime}</span>
              )}
            </div>
          </div>
        );
      })}

      {/* AI Thinking/Typing Indicator */}
      {isAiLoading && (
        <div className="flex items-start gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-[85%]">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div
            role="status"
            aria-label="Sedang mengetik..."
            className="rounded-2xl rounded-tl-sm bg-[#141417] border border-zinc-800 px-4 py-3 flex items-center gap-1.5 shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
            <span className="text-xs text-zinc-400 ml-2 font-medium">Sedang menganalisis...</span>
          </div>
        </div>
      )}
    </div>
  );
};
