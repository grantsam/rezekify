import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import {
  Sparkles,
  Lock,
  Mail,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

  const { login, register, forgotPassword, resetPassword } = useAuth();

  const handleTabChange = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        setSuccessMessage(null);
        await login(email, password);
      } else if (mode === 'register') {
        setSuccessMessage(null);
        if (!fullName.trim()) {
          throw new Error('Nama lengkap wajib diisi.');
        }
        await register(email, password, fullName);
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
        if (!newPassword || newPassword.length < 6) {
          throw new Error('Kata sandi baru minimal 6 karakter.');
        }
        if (!resetPassword) {
          throw new Error('Fitur pemulihan kata sandi tidak tersedia.');
        }
        const msg = await resetPassword(email, otpCode, newPassword);
        setMode('login');
        setPassword('');
        setOtpCode('');
        setNewPassword('');
        setSuccessMessage(msg || 'Kata sandi Anda berhasil diperbarui. Silakan masuk menggunakan kata sandi baru.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat memproses permintaan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage(null);
    setIsResending(true);
    try {
      if (!forgotPassword) {
        throw new Error('Fitur pemulihan kata sandi tidak tersedia.');
      }
      const msg = await forgotPassword(email);
      setSuccessMessage(msg || 'Kode verifikasi baru telah dikirim.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengirim ulang kode.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="min-h-screen bg-[#0c0c0e] flex items-center justify-center p-4 relative overflow-hidden text-zinc-100"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#141417] border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl mb-3">
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Rezekify
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Autonomous Multi-Modal Runway Manager</p>
        </div>

        {/* Tab Switcher for Login / Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-[#0c0c0e]/80 p-1.5 rounded-xl border border-zinc-800 mb-6">
            <Button
              variant="light"
              onPress={() => handleTabChange('login')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-transparent'
              }`}
            >
              Masuk (Login)
            </Button>
            <Button
              variant="light"
              onPress={() => handleTabChange('register')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'register' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-transparent'
              }`}
            >
              Daftar Akun
            </Button>
          </div>
        )}

        {/* Header for Forgot Password */}
        {mode === 'forgot_password' && (
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center p-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl mb-2">
              <KeyRound className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-base font-semibold text-white">Lupa Kata Sandi</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Masukkan alamat email akun Anda untuk menerima 6-digit kode verifikasi OTP.
            </p>
          </div>
        )}

        {/* Header for Reset Password */}
        {mode === 'reset_password' && (
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center p-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl mb-2">
              <KeyRound className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-base font-semibold text-white">Atur Ulang Kata Sandi</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Kode verifikasi telah dikirim ke{' '}
              <span className="font-semibold text-zinc-200">{email}</span>
            </p>
          </div>
        )}

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Forms */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-fullname" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  id="auth-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama Lengkap Anda"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-zinc-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <>
              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-zinc-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-sm placeholder-zinc-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-zinc-500 hover:text-zinc-300 transition-colors"
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
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer py-1"
                  >
                    Lupa kata sandi?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                isDisabled={isSubmitting}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 active:scale-[0.99] min-h-[44px]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
                <label htmlFor="auth-forgot-email" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="auth-forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-zinc-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                isDisabled={isSubmitting}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 active:scale-[0.99] min-h-[44px]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
                className="w-full text-zinc-400 hover:text-zinc-200 text-xs font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[44px] bg-transparent hover:bg-zinc-800/50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Masuk</span>
              </button>
            </>
          )}

          {mode === 'reset_password' && (
            <>
              <div>
                <label htmlFor="auth-otp" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Kode Verifikasi (6-Digit OTP)
                </label>
                <div className="relative">
                  <input
                    id="auth-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-center font-mono text-lg tracking-[0.3em] font-semibold placeholder-zinc-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-new-password" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Kata Sandi Baru
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="auth-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kata sandi baru"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-sm placeholder-zinc-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    aria-label={showNewPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                isDisabled={isSubmitting}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 active:scale-[0.99] min-h-[44px]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
                  disabled={isResending}
                  onClick={handleResendOtp}
                  className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 py-1 px-2 min-h-[38px]"
                >
                  {isResending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Kirim ulang kode</span>
                </button>
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-zinc-400 hover:text-zinc-200 font-medium transition-colors py-1 px-2 min-h-[38px]"
                >
                  Kembali ke Masuk
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </motion.div>
  );
};
