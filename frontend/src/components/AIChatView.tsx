import React, { useState, useEffect, useRef } from 'react';
import { TelemetrySnapshot, ChatMessageItem } from '../types/api';
import * as apiClient from '../services/apiClient';
import { ChatTelemetryStrip } from './ChatTelemetryStrip';
import { ChatMessageList } from './ChatMessageList';
import { ChatOmniInput } from './ChatOmniInput';

export interface AIChatViewProps {
  initialTelemetry?: TelemetrySnapshot | null;
  initialPrompt?: string;
  onNavigateToLedger: () => void;
  onDataMutated: () => Promise<void> | void;
  providerLabel?: string;
}

export const AIChatView: React.FC<AIChatViewProps> = ({
  initialTelemetry = null,
  initialPrompt,
  onNavigateToLedger,
  onDataMutated,
  providerLabel,
}) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(initialTelemetry || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [activePrompt, setActivePrompt] = useState<string>(initialPrompt || '');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync initialPrompt prop if it changes
  useEffect(() => {
    if (initialPrompt !== undefined) {
      setActivePrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // Sync initialTelemetry prop if it changes
  useEffect(() => {
    if (initialTelemetry) {
      setTelemetry(initialTelemetry);
    }
  }, [initialTelemetry]);

  // Load chat history on mount
  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      try {
        const history = await apiClient.getChatMessages();
        if (isMounted && Array.isArray(history)) {
          setMessages(history);
        }
      } catch (err) {
        console.error('Failed to load chat messages:', err);
      } finally {
        if (isMounted) {
          setIsHistoryLoading(false);
        }
      }
    };
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  // Smooth scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (text: string, file: File | null) => {
    const trimmed = text.trim();
    if (!trimmed && !file) return;

    setActivePrompt('');

    const tempUserMsgId = `user-${Date.now()}`;
    const userMsgContent = file
      ? (trimmed ? `${trimmed}\n[Struk: ${file.name}]` : `[Struk: ${file.name}]`)
      : trimmed;

    const userMsg: ChatMessageItem = {
      id: tempUserMsgId,
      role: 'user',
      content: userMsgContent,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      let res;
      if (file) {
        res = await apiClient.submitChatReceipt(file, trimmed || undefined);
      } else {
        res = await apiClient.submitChatMessage(trimmed);
      }

      const assistantMsg: ChatMessageItem = {
        id: res.message_id || `asst-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        transaction: res.transaction,
        metadata: { traces: res.traces, thought: res.thought || (res as any).thought },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.telemetry) {
        setTelemetry(res.telemetry);
      }
      if (res.transaction || res.telemetry) {
        await onDataMutated();
      }
    } catch (err: any) {
      const errorMsg: ChatMessageItem = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Gagal memproses permintaan: ${err?.message || 'Terjadi kesalahan sistem.'}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceSubmit = async (blob: Blob, caption?: string) => {
    setActivePrompt('');

    const tempUserMsgId = `user-voice-${Date.now()}`;
    const userMsgContent = caption
      ? `[Pesan Suara]: ${caption}`
      : '[Pesan Suara]';

    const userMsg: ChatMessageItem = {
      id: tempUserMsgId,
      role: 'user',
      content: userMsgContent,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await apiClient.submitChatVoice(blob, caption);

      const assistantMsg: ChatMessageItem = {
        id: res.message_id || `asst-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        transaction: res.transaction,
        metadata: { traces: res.traces, thought: res.thought || (res as any).thought },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.telemetry) {
        setTelemetry(res.telemetry);
      }
      if (res.transaction || res.telemetry) {
        await onDataMutated();
      }
    } catch (err: any) {
      const errorMsg: ChatMessageItem = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Gagal memproses rekaman suara: ${err?.message || 'Terjadi kesalahan sistem.'}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = async () => {
    setIsResetting(true);
    try {
      await apiClient.clearChatMessages();
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleCancelTransaction = async (transactionId: string) => {
    try {
      await apiClient.deleteTransaction(transactionId);
      await onDataMutated();
    } catch (err) {
      console.error('Failed to cancel transaction:', err);
      throw err;
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen flex flex-col min-w-0 bg-[#E6F7EF] dark:bg-[#021D17] text-slate-900 dark:text-white transition-colors duration-300 relative overflow-hidden">
      
      {/* AMBIENT RADIAL LIGHT DEKORATIF */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-radial from-[#10B981]/15 via-[#0F766E]/10 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-radial from-[#34D399]/15 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Sticky Telemetry Strip */}
      <div className="sticky top-0 z-20 backdrop-blur-2xl bg-white/70 dark:bg-[#042421]/80 border-b border-slate-200/80 dark:border-[#10B981]/20 shadow-xs">
        <ChatTelemetryStrip
          telemetry={telemetry}
          onResetChat={handleResetChat}
          isResetting={isResetting}
          providerLabel={providerLabel}
        />
      </div>

      {/* Middle Scrollable Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <ChatMessageList
          messages={messages}
          isAiLoading={isLoading}
          isHistoryLoading={isHistoryLoading}
          onCancelTransaction={handleCancelTransaction}
          onViewLedger={onNavigateToLedger}
          onSelectPrompt={(prompt) => setActivePrompt(prompt)}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Pinned Bottom Omni Input */}
      <div className="p-3 sm:p-4 bg-white/80 dark:bg-[#042421]/90 backdrop-blur-2xl border-t border-slate-200/80 dark:border-[#10B981]/30 shadow-lg relative z-20">
        <ChatOmniInput
          onSubmit={handleSubmit}
          onVoiceSubmit={handleVoiceSubmit}
          isLoading={isLoading}
          initialPrompt={activePrompt}
        />
      </div>
    </div>
  );
};