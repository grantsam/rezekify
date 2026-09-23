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
import { SettingsResponse, AIProviderType } from '../types/api';

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
  const [provider, setProvider] = useState<AIProviderType>('GEMINI');
  const [model, setModel] = useState<string>('gemini-2.5-flash');
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
      setProvider(data.ai.provider === 'SYSTEM' ? 'GEMINI' : data.ai.provider);
      setModel(data.ai.model || 'gemini-2.5-flash');
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
    try {
      setIsValidating(true);
      setValidationResult(null);
      const res = await validateAIKey({
        provider,
        api_key: apiKey.trim(),
        model,
      });
      setValidationResult(res);
    } catch (err: any) {
      setValidationResult({ valid: false, message: err?.message || 'Validasi koneksi gagal.' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveAISettings = async () => {
    try {
      setIsSaving(true);
      setFeedbackMsg(null);
      await updateAISettings({
        is_custom_ai_enabled: isCustomAi,
        provider: isCustomAi ? provider : 'SYSTEM',
        model,
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

  const availableModelsList = settings?.ai?.available_models?.[provider] || (
    provider === 'GEMINI'
      ? ['gemini-2.5-flash', 'gemini-2.5-pro']
      : ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile']
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      disableAnimation
      classNames={{
        base: 'bg-slate-900 border border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto',
        backdrop: 'bg-black/75',
        closeButton: 'hover:bg-slate-800 text-slate-400 hover:text-white',
      }}
    >
      <ModalContent>
        {() => (
          <div>
            <ModalHeader>
              <div className="flex items-center justify-between w-full pr-6">
                <div>
                  <h3 className="font-semibold text-lg text-slate-100">Pengaturan Akun & Sistem</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Kelola integrasi bot Telegram dan kuota AI kustom (BYOK)</p>
                </div>
                {isLoading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
              </div>
            </ModalHeader>

            <ModalBody className="pb-6">
              {feedbackMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedbackMsg.isError
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {feedbackMsg.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('telegram')}
                  className={`py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 min-h-[38px] ${
                    activeTab === 'telegram'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Integrasi Telegram</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 min-h-[38px] ${
                    activeTab === 'ai'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Model & Kunci AI (BYOK)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 min-h-[38px] ${
                    activeTab === 'profile'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Siklus & Ambang Batas</span>
                </button>
              </div>

              {/* TAB 1: TELEGRAM */}
              {activeTab === 'telegram' && (
                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Status Koneksi</span>
                      {settings?.telegram?.is_connected ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-sm font-semibold text-emerald-400">
                            Terhubung: ID {settings.telegram.telegram_chat_id}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="text-sm font-semibold text-amber-400">Belum Terhubung</span>
                        </div>
                      )}
                    </div>
                    {settings?.telegram?.is_connected && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={handleUnlinkTelegram}
                        disabled={isUnlinking}
                        className="text-rose-400 bg-rose-500/10 border border-rose-500/20 text-xs font-semibold rounded-xl"
                      >
                        {isUnlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Putuskan Hubungan'}
                      </Button>
                    )}
                  </div>

                  {!settings?.telegram?.is_connected ? (
                    <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-4">
                      <h4 className="text-xs font-semibold text-slate-200">Langkah Menghubungkan:</h4>
                      <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                        <li>Klik tombol <strong>Dapatkan Kode Pairing</strong> di bawah.</li>
                        <li>Klik tombol tautan instan 1-klik untuk membuka bot Telegram.</li>
                        <li>Tekan <strong>START</strong> di Telegram dan akun Anda langsung terhubung!</li>
                      </ol>

                      {!pairingCode ? (
                        <Button
                          size="sm"
                          onPress={handleGeneratePairingCode}
                          disabled={isGeneratingCode}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
                        >
                          {isGeneratingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dapatkan Kode Pairing Baru'}
                        </Button>
                      ) : (
                        <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-indigo-300 font-medium">Kode Pairing Anda:</span>
                            <span className="text-[11px] text-slate-400">Berlaku 15 menit</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-mono font-bold text-white tracking-wider bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 grow text-center">
                              {pairingCode}
                            </span>
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={handleCopyCode}
                              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl min-h-[44px]"
                            >
                              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <a
                            href={`https://t.me/${settings?.telegram?.bot_username || 'RezekifyBot'}?start=${pairingCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Buka Telegram Sekarang (1-Klik)
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2 text-xs text-slate-400">
                      <p>✅ Bot Telegram aktif dan siap menerima pesan.</p>
                      <p>Anda dapat mencatat pengeluaran langsung via teks santai, foto struk belanja, atau pesan suara.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: AI BYOK */}
              {activeTab === 'ai' && (
                <div className="space-y-4 pt-2">
                  {/* Mode Toggles */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCustomAi(false)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        !isCustomAi
                          ? 'bg-indigo-600/10 border-indigo-500/50 shadow-md shadow-indigo-600/10'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Server className={`w-4 h-4 ${!isCustomAi ? 'text-indigo-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-white">Shared Platform</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Infrastruktur rotary pool bersama gratis dari Rezekify. Tanpa konfigurasi.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCustomAi(true)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isCustomAi
                          ? 'bg-indigo-600/10 border-indigo-500/50 shadow-md shadow-indigo-600/10'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Radio className={`w-4 h-4 ${isCustomAi ? 'text-indigo-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-white">Bring Your Own Key</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Gunakan kuota API pribadi Anda (Gemini/Groq) untuk kapasitas tak terbatas.
                      </p>
                    </button>
                  </div>

                  {isCustomAi && (
                    <div className="space-y-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                      {/* Provider Selector */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Provider AI</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['GEMINI', 'GROQ'] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setProvider(p);
                                setModel(p === 'GEMINI' ? 'gemini-2.5-flash' : 'llama-3.3-70b-versatile');
                                setValidationResult(null);
                              }}
                              className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                                provider === p
                                  ? 'bg-slate-800 text-white border-indigo-500 shadow-sm'
                                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {p === 'GEMINI' ? 'Google Gemini' : 'Groq Cloud'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Model Selector */}
                      <div>
                        <label htmlFor="model-select" className="block text-xs font-medium text-slate-400 mb-1.5">
                          Model AI
                        </label>
                        <select
                          id="model-select"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          {availableModelsList.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* API Key Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="api-key-input" className="text-xs font-medium text-slate-400">
                            Kunci API {provider === 'GEMINI' ? 'Google Gemini' : 'Groq'}
                          </label>
                          {settings?.ai?.has_api_key && (
                            <span className="text-[11px] text-emerald-400">
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
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            aria-label={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                          >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="mt-1 flex justify-end">
                          <a
                            href={
                              provider === 'GEMINI'
                                ? 'https://aistudio.google.com/app/apikey'
                                : 'https://console.groq.com/keys'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-indigo-400 hover:underline inline-flex items-center gap-1"
                          >
                            Dapatkan API Key di {provider === 'GEMINI' ? 'Google AI Studio' : 'Groq Console'}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>

                      {/* Connection Test Banner */}
                      {validationResult && (
                        <div
                          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                            validationResult.valid
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                          }`}
                        >
                          {validationResult.valid ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                          <span>{validationResult.message}</span>
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-between gap-3">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={handleValidateKey}
                          disabled={isValidating || !apiKey.trim()}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold"
                        >
                          {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Uji Koneksi'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 flex justify-end">
                    <Button
                      size="sm"
                      onPress={handleSaveAISettings}
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs px-5 min-h-[38px]"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Pengaturan'}
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 3: SIKLUS & AMBANG BATAS */}
              {activeTab === 'profile' && (
                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                    <div>
                      <label htmlFor="monthly-cycle-day-input" className="block text-xs font-medium text-slate-300 mb-1">
                        Hari Siklus Finansial Bulanan
                      </label>
                      <p className="text-[11px] text-slate-400 mb-2">
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
                          className="w-28 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400">Tiap tanggal {monthlyCycleDay} per bulan</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-4">
                      <label htmlFor="safe-runway-threshold-input" className="block text-xs font-medium text-slate-300 mb-1">
                        Ambang Batas Jatah Harian Aman (IDR)
                      </label>
                      <p className="text-[11px] text-slate-400 mb-2">
                        Batas minimum pengeluaran harian aman. Bila jatah harian berada di bawah nominal ini, status runway menjadi WARNING.
                      </p>
                      <div className="space-y-2">
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 font-medium">Rp</span>
                          <input
                            id="safe-runway-threshold-input"
                            type="number"
                            min={1000}
                            step={1000}
                            value={safeRunwayThreshold}
                            onChange={(e) => setSafeRunwayThreshold(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/50">
                          <span>Preview Ambang Batas:</span>
                          <span className="font-semibold text-emerald-400">
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
                      disabled={isSavingProfile}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs px-5 min-h-[38px]"
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
