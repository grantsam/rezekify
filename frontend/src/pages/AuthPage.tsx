import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Sparkles,
  Coffee,
  Send,
  KeyRound,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// @ts-ignore
import rezekifyLogo from '../assets/icon_text_rezekify.png';
// @ts-ignore
import vigrisLabsLogo from '../assets/icon_text_vigrislabs.png';

export type AuthMode = 'login' | 'register' | 'forgot_password' | 'reset_password';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { isAuthenticated, login, register, forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleTabChange = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setResendCooldown(0);
  };

  const handleForgotPasswordClick = () => {
    setMode('forgot_password');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleBackToLogin = () => {
    setMode('login');
    setErrorMessage(null);
    setSuccessMessage(null);
    setResendCooldown(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        setSuccessMessage(null);
        await login(email, password);
        navigate('/dashboard', { replace: true });
      } else if (mode === 'register') {
        setSuccessMessage(null);
        if (!fullName.trim()) {
          throw new Error('Nama lengkap wajib diisi.');
        }
        await register(email, password, fullName);
        navigate('/dashboard', { replace: true });
      } else if (mode === 'forgot_password') {
        if (!email.trim()) {
          throw new Error('Alamat email wajib diisi.');
        }
        if (!forgotPassword) {
          throw new Error('Fitur pemulihan kata sandi tidak tersedia.');
        }
        const msg = await forgotPassword(email);
        setSuccessMessage(msg || 'Kode verifikasi telah dikirim ke kotak masuk Anda.');
        setMode('reset_password');
      } else if (mode === 'reset_password') {
        if (!otpCode.trim() || otpCode.trim().length !== 6) {
          throw new Error('Kode verifikasi harus 6 digit angka.');
        }
        if (!newPassword || newPassword.length < 8) {
          throw new Error('Kata sandi baru minimal 8 karakter.');
        }
        if (!resetPassword) {
          throw new Error('Fitur pemulihan kata sandi tidak tersedia.');
        }
        const msg = await resetPassword(email, otpCode, newPassword);
        setMode('login');
        setPassword('');
        setOtpCode('');
        setNewPassword('');
        setResendCooldown(0);
        setSuccessMessage(msg || 'Kata sandi Anda berhasil diperbarui. Silakan masuk menggunakan kata sandi baru.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat memproses permintaan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorMessage(null);
    setIsResending(true);
    try {
      if (!forgotPassword) {
        throw new Error('Fitur pemulihan kata sandi tidak tersedia.');
      }
      const msg = await forgotPassword(email);
      setSuccessMessage(msg || 'Kode verifikasi baru telah dikirim.');
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengirim ulang kode.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0e] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 lg:p-6 relative overflow-hidden select-none transition-colors duration-300">
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 lg:top-8 lg:left-8 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/80 dark:bg-[#141417]/90 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:border-emerald-500 hover:text-emerald-500 transition-all shadow-sm hover:scale-105"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Kembali ke Beranda</span>
      </button>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10 pt-16 lg:pt-0">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="lg:col-span-6 space-y-6 text-left hidden lg:block pr-2"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wide backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
              AI Financial Assistant
            </div>
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">
            Pencatatan Keuangan <br />
            <span className="text-[#0F766E] dark:text-[#10B981]">
              Secepat Kirim Pesan
            </span>
          </h1>

          <div className="relative pt-2">
            <div className="absolute -top-3 right-4 z-20 bg-white/95 dark:bg-[#141417] backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 p-3 rounded-2xl shadow-xl transition-all duration-300 ease-out flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#10B981]" />
              <p className="text-[11px] font-bold text-slate-800 dark:text-white">
                Otomatis Terkategori oleh AI <Sparkles className="w-3.5 h-3.5 text-emerald-400 inline ml-1" />
              </p>
            </div>

            <div className="w-full bg-white/70 dark:bg-[#141417]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[32px] p-5 shadow-2xl shadow-black/10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-900/10 dark:border-zinc-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0F766E] to-[#10B981] flex items-center justify-center text-white font-bold text-xs shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Rezekify Assistant</p>
                    <p className="text-[9px] text-[#0F766E] dark:text-emerald-300 font-semibold">Online • Ready to Process</p>
                  </div>
                </div>
                <span className="text-[10px] bg-[#10B981]/20 text-[#0F766E] dark:text-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                  Live Chat
                </span>
              </div>

              <div className="space-y-3 text-left">
                <div className="flex justify-end">
                  <div className="bg-[#10B981] text-white p-3 rounded-2xl rounded-tr-none max-w-[85%] shadow-md">
                    <p className="text-xs font-semibold">
                      "Barusan beli kopi & makan siang Rp 65.000 via QRIS Mandiri" <Coffee className="w-4 h-4 text-emerald-400 inline mr-1" />
                    </p>
                    <span className="text-[9px] font-medium text-emerald-100 block text-right mt-1">12:38 PM</span>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="bg-white/90 dark:bg-white/20 backdrop-blur-md border border-[#10B981]/30 dark:border-white/20 text-slate-800 dark:text-white p-3.5 rounded-2xl rounded-tl-none max-w-[90%] space-y-2 shadow-md">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F766E] dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      <span>Transaksi Berhasil Dicatat!</span>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-900/50 p-2.5 rounded-xl text-[11px] space-y-1 font-mono border border-slate-200 dark:border-white/10">
                      <p className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-300">Nominal:</span>
                        <strong className="text-[#0F766E] dark:text-emerald-300">Rp 65.000</strong>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-300">Kategori:</span>
                        <strong className="text-slate-800 dark:text-white">Makanan & Minuman</strong>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-300">Sumber:</span>
                        <strong className="text-slate-800 dark:text-white">QRIS Mandiri</strong>
                      </p>
                    </div>

                    <p className="text-[10px] text-[#0F766E] dark:text-emerald-200/90 italic font-medium">
                      "Sisa kuota anggaran harian kamu masih aman (Rp 185.000)."
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <div className="bg-white/90 dark:bg-white/10 backdrop-blur-md border border-[#10B981]/30 dark:border-white/20 rounded-full px-4 py-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 shadow-inner">
                  <span className="text-[11px] opacity-70">Ketik transaksi atau upload struk...</span>
                  <div className="w-6 h-6 rounded-full bg-[#10B981] text-white flex items-center justify-center font-bold text-xs">
                    <Send className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="lg:col-span-6 w-full"
        >
          <div className="bg-white/90 dark:bg-[#141417] backdrop-blur-3xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[36px] p-6 sm:p-10 shadow-2xl shadow-black/20 relative z-10 text-left transition-all">
            <div className="text-center mb-6 space-y-2">
              <h2 className="sr-only">Rezekify</h2>
              <div className="flex justify-center items-center">
                <img
                  src={rezekifyLogo}
                  alt="Rezekify Logo"
                  className="h-12 sm:h-14 w-auto object-contain drop-shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">
                Autonomous AI-Powered Personal Finance
              </p>
            </div>

            {/* Tab Switcher for Login / Register */}
            {(mode === 'login' || mode === 'register') && (
              <div className="flex bg-slate-100 dark:bg-zinc-900/60 p-1.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 mb-6">
                <Button
                  variant="light"
                  onPress={() => handleTabChange('login')}
                  className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all ${
                    mode === 'login'
                      ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-emerald-900/30'
                      : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500 bg-transparent'
                  }`}
                >
                  Masuk (Login)
                </Button>
                <Button
                  variant="light"
                  onPress={() => handleTabChange('register')}
                  className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all ${
                    mode === 'register'
                      ? 'bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white shadow-md shadow-emerald-900/30'
                      : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500 bg-transparent'
                  }`}
                >
                  Daftar Akun
                </Button>
              </div>
            )}

            {/* Header for Forgot Password */}
            {mode === 'forgot_password' && (
              <div className="mb-6 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mb-2 text-emerald-600 dark:text-emerald-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Lupa Kata Sandi</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                  Masukkan alamat email akun Anda untuk menerima 6-digit kode verifikasi OTP.
                </p>
              </div>
            )}

            {/* Header for Reset Password */}
            {mode === 'reset_password' && (
              <div className="mb-6 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mb-2 text-emerald-600 dark:text-emerald-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Atur Ulang Kata Sandi</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                  Kode verifikasi telah dikirim ke{' '}
                  <span className="font-extrabold text-slate-900 dark:text-emerald-400">{email}</span>
                </p>
              </div>
            )}

            {/* Feedback Banners */}
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-rose-500/10 dark:bg-rose-950/60 border border-rose-500/40 rounded-2xl text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2.5 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Forms */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-fullname" className="block text-xs font-extrabold text-slate-800 dark:text-zinc-200 mb-1.5">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#10B981] absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      id="auth-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nama Lengkap Anda"
                      className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-3 text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all shadow-sm"
                    />
                  </div>
                </div>
              )}

              {(mode === 'login' || mode === 'register') && (
                <>
                  <div>
                    <label htmlFor="auth-email" className="block text-xs font-extrabold text-slate-800 dark:text-zinc-200 mb-1.5">
                      Alamat Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#10B981] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        id="auth-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-3 text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="auth-password" className="block text-xs font-extrabold text-slate-800 dark:text-zinc-200 mb-1.5">
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#10B981] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 rounded-2xl pl-10 pr-10 py-3 text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all shadow-sm"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {mode === 'login' && (
                    <div className="flex justify-end -mt-1">
                      <button
                        type="button"
                        onClick={handleForgotPasswordClick}
                        className="text-xs text-[#0F766E] dark:text-[#10B981] hover:underline font-bold transition-colors cursor-pointer py-1 min-h-[38px] flex items-center"
                      >
                        Lupa kata sandi?
                      </button>
                    </div>
                  )}

                  <Button
                    type="submit"
                    isDisabled={isSubmitting}
                    className="w-full mt-4 bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 active:scale-[0.99] min-h-[48px] text-sm"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <>
                        <span>{mode === 'login' ? 'Masuk ke Rezekify' : 'Buat Akun Sekarang'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </>
              )}

              {mode === 'forgot_password' && (
                <>
                  <div>
                    <label htmlFor="auth-forgot-email" className="block text-xs font-extrabold text-slate-800 dark:text-zinc-200 mb-1.5">
                      Alamat Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#10B981] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        id="auth-forgot-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-3 text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    isDisabled={isSubmitting}
                    className="w-full mt-4 bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 active:scale-[0.99] min-h-[48px] text-sm"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <>
                        <span>Kirim Kode Verifikasi</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold py-2.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 min-h-[44px] bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800/50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali ke Masuk</span>
                  </button>
                </>
              )}

              {mode === 'reset_password' && (
                <>
                  <div>
                    <label htmlFor="auth-otp" className="block text-xs font-extrabold text-slate-800 dark:text-zinc-200 mb-1.5">
                      Kode Verifikasi (6-Digit OTP)
                    </label>
                    <div className="relative">
                      <input
                        id="auth-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-center font-mono text-lg tracking-[0.3em] font-extrabold placeholder-slate-300 dark:placeholder-slate-600 text-slate-900 dark:text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="auth-new-password" className="block text-xs font-extrabold text-slate-800 dark:text-zinc-200 mb-1.5">
                      Kata Sandi Baru
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#10B981] absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        id="auth-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        maxLength={72}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Kata sandi baru"
                        className="w-full bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 rounded-2xl pl-10 pr-10 py-3 text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-white focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all shadow-sm"
                      />
                      <button
                        type="button"
                        aria-label={showNewPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    isDisabled={isSubmitting}
                    className="w-full mt-4 bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 active:scale-[0.99] min-h-[48px] text-sm"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <>
                        <span>Perbarui Kata Sandi</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between pt-2 text-xs">
                    <button
                      type="button"
                      disabled={isResending || resendCooldown > 0}
                      onClick={handleResendOtp}
                      className="text-[#0F766E] dark:text-[#10B981] hover:underline font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 py-1 px-2 min-h-[38px]"
                    >
                      {isResending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {resendCooldown > 0 ? `Kirim ulang kode (${resendCooldown}s)` : 'Kirim ulang kode'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBackToLogin}
                      className="text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-bold transition-colors py-1 px-2 min-h-[38px]"
                    >
                      Kembali ke Masuk
                    </button>
                  </div>
                </>
              )}
            </form>

            <div className="mt-8 pt-4 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Developed by</span>
              <div className="bg-white p-1 rounded-lg border border-slate-200/80 shadow-2xs">
                <img
                  src={vigrisLabsLogo}
                  alt="Vigris Labs"
                  className="h-5 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
