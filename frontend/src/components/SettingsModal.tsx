import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
} from '@heroui/react';
import {
  Bot,
  Send,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
  Server,
  Calendar,
} from 'lucide-react';
import {
  getSettings,
  validateAIKey,
  updateAISettings,
  unlinkTelegram,
  getTelegramPairingCode,
  updateUserProfile,
} from '../services/apiClient';
import { SettingsResponse, AIProtocolType } from '../types/api';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'telegram' | 'ai' | 'profile'>('telegram');
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isUnlinking, setIsUnlinking] = useState<boolean>(false);

  // Profile cycle & runway threshold form state
  const [monthlyCycleDay, setMonthlyCycleDay] = useState<number>(1);
  const [safeRunwayThreshold, setSafeRunwayThreshold] = useState<number>(30000);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // AI BYOK form state
  const [isCustomAi, setIsCustomAi] = useState<boolean>(false);
  const [protocol, setProtocol] = useState<AIProtocolType>('OPENAI');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ isError: boolean; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getSettings();
      setSettings(data);
      setIsCustomAi(data.ai.is_custom_ai_enabled);
      setProtocol(data.ai.protocol ?? 'OPENAI');
      setBaseUrl(data.ai.base_url ?? '');
      setModel(data.ai.model ?? '');
      if (data.profile) {
        setMonthlyCycleDay(data.profile.monthly_cycle_day ?? 1);
        setSafeRunwayThreshold(data.profile.safe_runway_threshold ?? 30000);
      }
    } catch (err: any) {
      setFeedbackMsg({ isError: true, text: err?.message || 'Gagal memuat pengaturan.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      setValidationResult(null);
      setFeedbackMsg(null);
      setPairingCode(null);
    }
  }, [isOpen, fetchSettings]);

  if (!isOpen) return null;

  const handleGeneratePairingCode = async () => {
    try {
      setIsGeneratingCode(true);
      setFeedbackMsg(null);
      const res = await getTelegramPairingCode();
      setPairingCode(res.pairing_code);
    } catch (err: any) {
      setFeedbackMsg({ isError: true, text: err?.message || 'Gagal menghasilkan kode pairing.' });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(pairingCode).catch(() => {});
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleUnlinkTelegram = async () => {
    try {
      setIsUnlinking(true);
      setFeedbackMsg(null);
      await unlinkTelegram();
      setFeedbackMsg({ isError: false, text: 'Akun Telegram berhasil diputuskan.' });
      await fetchSettings();
      onSettingsUpdated?.();
    } catch (err: any) {
      setFeedbackMsg({ isError: true, text: err?.message || 'Gagal memutuskan hubungan Telegram.' });
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleValidateKey = async () => {
    if (!apiKey.trim()) {
      setValidationResult({ valid: false, message: 'Kunci API wajib diisi untuk menguji koneksi.' });
      return;
    }
    if (!baseUrl.trim()) {
      setValidationResult({ valid: false, message: 'Base URL wajib diisi untuk menguji koneksi.' });
      return;
    }
    if (!baseUrl.trim().startsWith('https://')) {
      setValidationResult({ valid: false, message: 'Base URL harus menggunakan protokol HTTPS (https://).' });
      return;
    }
    try {
      setIsValidating(true);
      setValidationResult(null);
      const res = await validateAIKey({
        protocol,
        base_url: baseUrl.trim(),
        model: model.trim() || undefined,
        api_key: apiKey.trim(),
      });
      setValidationResult(res);
    } catch (err: any) {
      setValidationResult({ valid: false, message: err?.message || 'Validasi koneksi gagal.' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveAISettings = async () => {
    if (isCustomAi) {
      if (!baseUrl.trim()) {
        setFeedbackMsg({ isError: true, text: 'Base URL wajib diisi saat mengaktifkan endpoint custom.' });
        return;
      }
      if (!baseUrl.trim().startsWith('https://')) {
        setFeedbackMsg({ isError: true, text: 'Base URL harus diawali dengan https://' });
        return;
      }
      if (!model.trim()) {
        setFeedbackMsg({ isError: true, text: 'Nama model wajib diisi saat mengaktifkan endpoint custom.' });
        return;
      }
    }
    try {
      setIsSaving(true);
      setFeedbackMsg(null);
      await updateAISettings({
        is_custom_ai_enabled: isCustomAi,
        provider: isCustomAi ? 'CUSTOM' : 'SYSTEM',
        protocol: isCustomAi ? protocol : undefined,
        base_url: isCustomAi ? baseUrl.trim() : undefined,
        model: model.trim(),
        api_key: apiKey.trim() || undefined,
      });
      setFeedbackMsg({ isError: false, text: 'Pengaturan AI berhasil disimpan.' });
      setApiKey('');
      await fetchSettings();
      onSettingsUpdated?.();
    } catch (err: any) {
      setFeedbackMsg({ isError: true, text: err?.message || 'Gagal menyimpan pengaturan AI.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    const cycleDay = Number(monthlyCycleDay);
    const threshold = Number(safeRunwayThreshold);

    if (isNaN(cycleDay) || cycleDay < 1 || cycleDay > 31) {
      setFeedbackMsg({ isError: true, text: 'Hari siklus bulanan harus antara tanggal 1 dan 31.' });
      return;
    }
    if (isNaN(threshold) || threshold <= 0) {
      setFeedbackMsg({ isError: true, text: 'Ambang batas runway aman harus lebih besar dari 0.' });
      return;
    }

    try {
      setIsSavingProfile(true);
      setFeedbackMsg(null);
      await updateUserProfile({
        monthly_cycle_day: cycleDay,
        safe_runway_threshold: threshold,
      });
      setFeedbackMsg({ isError: false, text: 'Preferensi siklus dan ambang batas berhasil disimpan.' });
      await fetchSettings();
      onSettingsUpdated?.();
    } catch (err: any) {
      setFeedbackMsg({ isError: true, text: err?.message || 'Gagal menyimpan preferensi profil.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      disableAnimation
      classNames={{
        base: 'bg-white dark:bg-[#141417] border border-slate-200/80 dark:border-zinc-800/80 text-slate-900 dark:text-white max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] shadow-2xl shadow-black/10 text-left select-none',
        backdrop: 'bg-black/60 backdrop-blur-md',
        closeButton: 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl',
      }}
    >
      <ModalContent>
        {() => (
          <div>
            <ModalHeader>
              <div className="flex items-center justify-between w-full pr-6">
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Pengaturan Akun & Sistem</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">Kelola integrasi bot Telegram dan kuota AI kustom (BYOK)</p>
                </div>
                {isLoading && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
              </div>
            </ModalHeader>

            <ModalBody className="pb-6 space-y-4">
              {feedbackMsg && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                    feedbackMsg.isError
                      ? 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300'
                      : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {feedbackMsg.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-zinc-900/60 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800/80 text-xs">
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setActiveTab('telegram')}
                  className={`py-2 px-3 rounded-xl font-extrabold transition-all flex items-center justify-center gap-2 min-h-[38px] ${
                    activeTab === 'telegram'
                      ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-emerald-900/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Integrasi Telegram</span>
                  <span className="sm:hidden">Telegram</span>
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setActiveTab('ai')}
                  className={`py-2 px-3 rounded-xl font-extrabold transition-all flex items-center justify-center gap-2 min-h-[38px] ${
                    activeTab === 'ai'
                      ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-emerald-900/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Model & Kunci AI (BYOK)</span>
                  <span className="sm:hidden">AI BYOK</span>
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setActiveTab('profile')}
                  className={`py-2 px-3 rounded-xl font-extrabold transition-all flex items-center justify-center gap-2 min-h-[38px] ${
                    activeTab === 'profile'
                      ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-emerald-900/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Siklus & Ambang Batas</span>
                  <span className="sm:hidden">Siklus</span>
                </Button>
              </div>

              {/* TAB 1: TELEGRAM */}
              {activeTab === 'telegram' && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Status Koneksi</span>
                      {settings?.telegram?.is_connected ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            Terhubung: ID {settings.telegram.telegram_chat_id}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400">Belum Terhubung</span>
                        </div>
                      )}
                    </div>
                    {settings?.telegram?.is_connected && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={handleUnlinkTelegram}
                        isDisabled={isUnlinking}
                        className="text-rose-600 dark:text-rose-300 bg-rose-500/15 border border-rose-500/30 text-xs font-extrabold rounded-xl"
                      >
                        {isUnlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Putuskan Hubungan'}
                      </Button>
                    )}
                  </div>

                  {!settings?.telegram?.is_connected ? (
                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl space-y-4">
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Langkah Menghubungkan:</h4>
                      <ol className="text-xs text-slate-600 dark:text-slate-300 font-medium space-y-2 list-decimal list-inside">
                        <li>Klik tombol <strong>Dapatkan Kode Pairing</strong> di bawah.</li>
                        <li>Klik tombol tautan instan 1-klik untuk membuka bot Telegram.</li>
                        <li>Tekan <strong>START</strong> di Telegram dan akun Anda langsung terhubung!</li>
                      </ol>

                      {!pairingCode ? (
                        <Button
                          size="sm"
                          onPress={handleGeneratePairingCode}
                          isDisabled={isGeneratingCode}
                          className="w-full bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold rounded-xl min-h-[40px] shadow-md shadow-emerald-900/20"
                        >
                          {isGeneratingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dapatkan Kode Pairing Baru'}
                        </Button>
                      ) : (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Kode Pairing Anda:</span>
                            <span className="text-[11px] text-slate-500 font-medium">Berlaku 15 menit</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white tracking-wider bg-white dark:bg-zinc-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 grow text-center">
                              {pairingCode}
                            </span>
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={handleCopyCode}
                              className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl min-h-[44px]"
                            >
                              {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <a
                            href={`https://t.me/${settings?.telegram?.bot_username || 'RezekifyBot'}?start=${pairingCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 px-4 bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-900/20"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Buka Telegram Sekarang (1-Klik)
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl space-y-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                      <p>✅ Bot Telegram aktif dan siap menerima pesan.</p>
                      <p>Anda dapat mencatat pengeluaran langsung via teks santai, foto struk belanja, atau pesan suara.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: AI BYOK */}
              {activeTab === 'ai' && (
                <div className="space-y-4 pt-1">
                  {/* Mode Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      variant="flat"
                      onPress={() => setIsCustomAi(false)}
                      className={`p-3.5 rounded-2xl border text-left transition-all h-auto block min-h-[76px] ${
                        !isCustomAi
                          ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-900/10'
                          : 'bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Server className={`w-4 h-4 ${!isCustomAi ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">Shared Platform</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium whitespace-normal">
                        Infrastruktur rotary pool bersama gratis dari Rezekify. Tanpa konfigurasi.
                      </p>
                    </Button>

                    <Button
                      variant="flat"
                      onPress={() => setIsCustomAi(true)}
                      className={`p-3.5 rounded-2xl border text-left transition-all h-auto block min-h-[76px] ${
                        isCustomAi
                          ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-900/10'
                          : 'bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Radio className={`w-4 h-4 ${isCustomAi ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">Bring Your Own Key</span>
                        {isCustomAi && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            {protocol === 'OPENAI' ? 'OpenAI-compat' : 'Anthropic-compat'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium whitespace-normal">
                        Gunakan custom endpoint (OpenAI/Anthropic-compatible) dengan API key pribadi Anda.
                      </p>
                    </Button>
                  </div>

                  {isCustomAi && (
                    <div className="space-y-4 p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl">
                      {/* Protocol Selector */}
                      <div>
                        <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                          Protokol Endpoint
                        </label>
                        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Protokol Endpoint">
                          <Button
                            role="radio"
                            aria-checked={protocol === 'OPENAI'}
                            onPress={() => {
                              setProtocol('OPENAI');
                              setValidationResult(null);
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all min-h-[40px] flex items-center justify-center ${
                              protocol === 'OPENAI'
                                ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white border-emerald-500 shadow-sm'
                                : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800'
                            }`}
                          >
                            OpenAI-compatible
                          </Button>
                          <Button
                            role="radio"
                            aria-checked={protocol === 'ANTHROPIC'}
                            onPress={() => {
                              setProtocol('ANTHROPIC');
                              setValidationResult(null);
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all min-h-[40px] flex items-center justify-center ${
                              protocol === 'ANTHROPIC'
                                ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white border-emerald-500 shadow-sm'
                                : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800'
                            }`}
                          >
                            Anthropic-compatible
                          </Button>
                        </div>
                      </div>

                      {/* Base URL Input */}
                      <div>
                        <label htmlFor="base-url-input" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                          Base URL Endpoint
                        </label>
                        <input
                          id="base-url-input"
                          type="url"
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          placeholder={protocol === 'ANTHROPIC' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'}
                          className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 focus:border-zinc-600 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none font-medium min-h-[38px]"
                        />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                          Harus diawali https:// (contoh: {protocol === 'ANTHROPIC' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1, https://api.groq.com/openai/v1'})
                        </p>
                      </div>

                      {/* Model Input */}
                      <div>
                        <label htmlFor="model-input" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1.5">
                          Nama Model
                        </label>
                        <input
                          id="model-input"
                          type="text"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          placeholder={protocol === 'ANTHROPIC' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini'}
                          className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 focus:border-zinc-600 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none font-medium min-h-[38px]"
                        />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                          Contoh: {protocol === 'ANTHROPIC' ? 'claude-3-5-haiku-20241022, claude-3-7-sonnet-20250219' : 'gpt-4o-mini, llama-3.3-70b-versatile, deepseek-chat'}
                        </p>
                      </div>

                      {/* API Key Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="api-key-input" className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                            Kunci API (API Key)
                          </label>
                          {settings?.ai?.has_api_key && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                              Tersimpan ({settings.ai.key_hint || '...'})
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            id="api-key-input"
                            type={showKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={
                              settings?.ai?.has_api_key
                                ? 'Biarkan kosong jika tidak ingin mengubah'
                                : 'Masukkan kunci API Anda'
                            }
                            className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 focus:border-zinc-600 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none font-medium pr-10 min-h-[38px]"
                          />
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => setShowKey(!showKey)}
                            aria-label={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white min-w-[38px] min-h-[38px] flex items-center justify-center p-0 bg-transparent"
                          >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                        <div className="mt-1.5 flex justify-end">
                          {protocol === 'ANTHROPIC' ? (
                            <a
                              href="https://console.anthropic.com/settings/keys"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 font-bold"
                            >
                              Dapatkan API Key di Anthropic Console
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium inline-flex items-center gap-1">
                              Dapatkan API Key di penyedia endpoint Anda (mis.{' '}
                              <a
                                href="https://platform.openai.com/api-keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 font-bold"
                              >
                                OpenAI <ExternalLink className="w-2 h-2" />
                              </a>
                              ,{' '}
                              <a
                                href="https://console.groq.com/keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 font-bold"
                              >
                                Groq <ExternalLink className="w-2 h-2" />
                              </a>
                              )
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Connection Test Banner */}
                      {validationResult && (
                        <div
                          role="status"
                          aria-live="polite"
                          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                            validationResult.valid
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-300'
                          }`}
                        >
                          {validationResult.valid ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                          <span>{validationResult.message}</span>
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-between gap-3">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={handleValidateKey}
                          isDisabled={isValidating || !apiKey.trim() || !baseUrl.trim()}
                          className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-extrabold min-h-[38px] px-4"
                        >
                          {isValidating ? (
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menguji...
                            </span>
                          ) : (
                            'Uji Koneksi'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onPress={handleSaveAISettings}
                      isDisabled={isSaving}
                      className="bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold rounded-xl text-xs px-5 min-h-[38px] shadow-md shadow-emerald-900/20"
                    >
                      {isSaving ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                        </span>
                      ) : (
                        'Simpan Pengaturan'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 3: SIKLUS & AMBANG BATAS */}
              {activeTab === 'profile' && (
                <div className="space-y-4 pt-1">
                  <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl space-y-4">
                    <div>
                      <label htmlFor="monthly-cycle-day-input" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                        Hari Siklus Finansial Bulanan
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-2">
                        Pilih tanggal antara 1 sampai 31 yang menandai awal bulan finansial atau tanggal gajian Anda.
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          id="monthly-cycle-day-input"
                          type="number"
                          min={1}
                          max={31}
                          value={monthlyCycleDay}
                          onChange={(e) => setMonthlyCycleDay(parseInt(e.target.value, 10) || 1)}
                          className="w-28 bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 focus:border-zinc-600 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none font-mono font-bold"
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">Tiap tanggal {monthlyCycleDay} per bulan</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/80 dark:border-zinc-800/80 pt-4">
                      <label htmlFor="safe-runway-threshold-input" className="block text-xs font-extrabold text-slate-600 dark:text-slate-300 mb-1">
                        Ambang Batas Jatah Harian Aman (IDR)
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-2">
                        Batas minimum pengeluaran harian aman. Bila jatah harian berada di bawah nominal ini, status runway menjadi WARNING.
                      </p>
                      <div className="space-y-2">
                        <div className="relative">
                          <span className="absolute left-4 top-2.5 text-xs text-slate-400 font-mono font-bold">Rp</span>
                          <input
                            id="safe-runway-threshold-input"
                            type="number"
                            min={1000}
                            step={1000}
                            value={safeRunwayThreshold}
                            onChange={(e) => setSafeRunwayThreshold(parseFloat(e.target.value) || 0)}
                            className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 focus:border-zinc-600 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none font-mono font-bold"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-zinc-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800/80">
                          <span className="font-semibold">Preview Ambang Batas:</span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                            Rp {Number(safeRunwayThreshold || 0).toLocaleString('id-ID')} / hari
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onPress={handleSaveProfile}
                      isDisabled={isSavingProfile}
                      className="bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold rounded-xl text-xs px-5 min-h-[38px] shadow-md shadow-emerald-900/20"
                    >
                      {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Preferensi Siklus'}
                    </Button>
                  </div>
                </div>
              )}
            </ModalBody>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};