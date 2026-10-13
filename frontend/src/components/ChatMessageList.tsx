import React, { useState } from 'react';
import { Sparkles, ArrowRight, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { ChatMessageItem } from '../types/api';
import { ChatTransactionCard } from './ChatTransactionCard';

export interface ChatMessageListProps {
  messages: ChatMessageItem[];
  isAiLoading?: boolean;
  isHistoryLoading?: boolean;
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

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isAiLoading = false,
  isHistoryLoading = false,
  onCancelTransaction,
  onViewLedger,
  onSelectPrompt,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});

  const handleCopy = (id: string, text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch {
      // safe fallback
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const toggleTrace = (id: string) => {
    setExpandedTraces((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (isHistoryLoading) {
    return (
      <div
        role="status"
        aria-label="Memuat riwayat percakapan..."
        className="space-y-4 py-4 animate-pulse select-none"
      >
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-[#042421] shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-200 dark:bg-[#042421] rounded-xl w-3/4" />
            <div className="h-3 bg-slate-100 dark:bg-[#042421]/60 rounded-xl w-1/2" />
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="h-10 bg-slate-200 dark:bg-[#042421] rounded-2xl w-48" />
        </div>
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-[#042421] shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-200 dark:bg-[#042421] rounded-xl w-2/3" />
            <div className="h-3 bg-slate-100 dark:bg-[#042421]/60 rounded-xl w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !isAiLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] mb-3 shadow-lg shadow-[#10B981]/10">
          <Sparkles className="w-7 h-7 text-[#10B981]" />
        </div>
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">Asisten Finansial AI</h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-200/80 font-medium max-w-sm mt-1 mb-6 leading-relaxed">
          Catat transaksi cepat, foto struk, kirim voice note, atau konsultasikan kondisi arus kas harian Anda.
        </p>

        {onSelectPrompt && (
          <div className="w-full max-w-md space-y-2 text-left">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-emerald-300/60 block px-1">
              Contoh Pertanyaan Cepat
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEFAULT_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSelectPrompt(prompt)}
                  className="group flex items-center justify-between p-3 rounded-2xl bg-white/80 dark:bg-[#042421]/80 hover:bg-[#10B981]/10 border border-slate-200/80 dark:border-[#10B981]/30 text-left transition-all active:scale-[0.98] min-h-[44px] shadow-xs"
                >
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-[#0F766E] dark:group-hover:text-[#10B981] line-clamp-2">
                    {prompt}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#10B981] shrink-0 ml-2 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div role="log" aria-live="polite" className="space-y-4">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const formattedTime = formatTime(msg.created_at);

        if (isUser) {
          return (
            <div key={msg.id} className="flex flex-col items-end">
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-gradient-to-r from-[#0F766E] to-[#10B981] px-4 py-3 text-xs sm:text-sm text-white font-medium shadow-md shadow-[#10B981]/15 leading-relaxed whitespace-pre-wrap break-words select-text">
                {msg.content}
              </div>
              {formattedTime && (
                <span className="text-[10px] text-slate-400 dark:text-emerald-300/60 font-semibold mt-1 mr-1">{formattedTime}</span>
              )}
            </div>
          );
        }

        const rawTraces = msg.metadata?.traces ?? (msg as any).traces;
        const traces: Array<any> = Array.isArray(rawTraces) ? rawTraces : [];
        const thought = msg.metadata?.thought ?? (msg as any).thought;
        const hasTracesOrThought = traces.length > 0 || Boolean(thought);
        const isTraceOpen = Boolean(expandedTraces[msg.id]);

        return (
          <div key={msg.id} className="flex items-start gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-[85%]">
            <div
              className="w-8 h-8 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] shrink-0 mt-0.5 shadow-xs"
              aria-label="AI Assistant"
            >
              <Sparkles className="w-4 h-4 text-[#10B981]" />
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              {/* ponytail: traces accordion supports single-turn or multi-turn hops; upgrade to full streaming trace steps if backend enables SSE token streaming. */}
              {hasTracesOrThought && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleTrace(msg.id)}
                    aria-expanded={isTraceOpen}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-[#10B981]/10 dark:hover:bg-[#10B981]/20 border border-emerald-500/20 dark:border-[#10B981]/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-all active:scale-[0.99] w-fit shadow-xs"
                  >
                    <span>💭</span>
                    <span>
                      {traces.length > 0
                        ? `Proses Berpikir & Aktivitas (${traces.length} langkah)`
                        : 'Proses Berpikir & Aktivitas'}
                    </span>
                    {isTraceOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 ml-0.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>

                  {isTraceOpen && (
                    <div className="space-y-2 p-2.5 sm:p-3 rounded-xl bg-slate-50/80 dark:bg-[#03201B]/80 border border-slate-200/80 dark:border-[#10B981]/25 text-xs animate-in fade-in duration-150 select-text">
                      {thought && (
                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed select-text">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-0.5">
                            Penalaran Asisten
                          </span>
                          <p className="italic font-serif">"{thought}"</p>
                        </div>
                      )}

                      {traces.map((trace, idx) => {
                        const stepNum = trace.hop || idx + 1;
                        const toolName = trace.tool_name;
                        const traceThought = trace.thought;
                        const hasArgs =
                          trace.tool_args &&
                          (typeof trace.tool_args === 'object'
                            ? Object.keys(trace.tool_args).length > 0
                            : true);
                        const hasObservation =
                          trace.observation !== undefined && trace.observation !== null;

                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-white/90 dark:bg-[#021A15]/80 border border-slate-200/80 dark:border-[#10B981]/20 space-y-1.5"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                                Langkah {stepNum}
                              </span>
                              {toolName ? (
                                <span className="text-xs font-bold text-slate-800 dark:text-emerald-100">
                                  Memanggil{' '}
                                  <code className="font-mono text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded bg-slate-100 dark:bg-[#042421] text-[11px]">
                                    {toolName}
                                  </code>
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-600 dark:text-emerald-300/80">
                                  Sintesis Jawaban
                                </span>
                              )}
                            </div>

                            {traceThought && traceThought !== thought && (
                              <p className="text-[11px] italic text-slate-600 dark:text-emerald-200/80 font-serif pl-1">
                                "{traceThought}"
                              </p>
                            )}

                            {hasArgs && (
                              <div className="text-[11px] font-mono bg-slate-100/90 dark:bg-[#042421]/90 rounded p-2 text-slate-700 dark:text-emerald-200/90 overflow-x-auto border border-slate-200/50 dark:border-emerald-900/30">
                                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-emerald-400/60 block mb-0.5">
                                  Parameter
                                </span>
                                <pre className="whitespace-pre-wrap break-words select-text cursor-text">
                                  {JSON.stringify(trace.tool_args, null, 2)}
                                </pre>
                              </div>
                            )}

                            {hasObservation && (
                              <div className="text-[11px] font-mono bg-slate-100/90 dark:bg-[#042421]/90 rounded p-2 text-slate-700 dark:text-emerald-200/90 overflow-x-auto border border-slate-200/50 dark:border-emerald-900/30">
                                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 dark:text-emerald-400/60 block mb-0.5">
                                  Observasi
                                </span>
                                <pre className="whitespace-pre-wrap break-words select-text cursor-text">
                                  {typeof trace.observation === 'object'
                                    ? JSON.stringify(trace.observation, null, 2)
                                    : String(trace.observation)}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl rounded-tl-xs bg-white dark:bg-[#042421] border border-slate-200/80 dark:border-[#10B981]/30 px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white font-medium shadow-md shadow-[#10B981]/5 leading-relaxed whitespace-pre-wrap break-words select-text cursor-text">
                {msg.content}
              </div>

              {msg.transaction && (
                <ChatTransactionCard
                  transaction={msg.transaction}
                  onCancel={onCancelTransaction}
                  onViewLedger={onViewLedger}
                />
              )}

              <div className="flex items-center gap-2 ml-1">
                {formattedTime && (
                  <span className="text-[10px] text-slate-400 dark:text-emerald-300/60 font-semibold">{formattedTime}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleCopy(msg.id, msg.content)}
                  aria-label="Salin teks tanggapan"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-emerald-300/70 hover:text-slate-700 dark:hover:text-emerald-200 transition-colors py-0.5 px-1.5 rounded hover:bg-slate-100 dark:hover:bg-[#021A15]"
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* AI Thinking/Typing Indicator */}
      {isAiLoading && (
        <div className="flex items-start gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-[85%]">
          <div className="w-8 h-8 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-[#10B981]" />
          </div>
          <div
            role="status"
            aria-label="Sedang mengetik..."
            className="rounded-2xl rounded-tl-xs bg-white dark:bg-[#042421] border border-slate-200/80 dark:border-[#10B981]/30 px-4 py-3 flex items-center gap-1.5 shadow-md shadow-[#10B981]/5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: '300ms' }} />
            <span className="text-xs text-slate-500 dark:text-emerald-200/80 ml-2 font-bold">Sedang menganalisis...</span>
          </div>
        </div>
      )}
    </div>
  );
};