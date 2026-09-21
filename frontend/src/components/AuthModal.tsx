import React, { useState } from 'react';
import { LogIn, UserPlus, Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, Button } from '@heroui/react';
import { apiFetch, setAuthToken } from '../services/apiClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = React.useCallback((node: HTMLElement | null) => {
    if (!node) return;
    node.setAttribute('aria-labelledby', 'auth-modal-title');
    const observer = new MutationObserver(() => {
      if (node.getAttribute('aria-labelledby') !== 'auth-modal-title') {
        node.setAttribute('aria-labelledby', 'auth-modal-title');
      }
    });
    observer.observe(node, { attributes: true, attributeFilter: ['aria-labelledby'] });
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'register') {
        if (!fullName.trim() || !email.trim() || !password.trim()) {
          throw new Error('Semua bidang wajib diisi.');
        }
        const res = await apiFetch<{ access_token: string }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim(),
            password: password.trim(),
          }),
        });
        setAuthToken(res.access_token);
      } else {
        if (!email.trim() || !password.trim()) {
          throw new Error('Email dan password wajib diisi.');
        }
        const res = await apiFetch<{ access_token: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password: password.trim(),
          }),
        });
        setAuthToken(res.access_token);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal memproses autentikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      ref={dialogRef}
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      classNames={{
        base: 'bg-slate-900 border border-slate-800 text-white max-w-md',
        backdrop: 'bg-black/75',
        closeButton: 'hover:bg-slate-800 text-slate-400 hover:text-white',
      }}
    >
      <ModalContent>
        {() => (
          <div
            ref={(el) => {
              el?.closest('[role="dialog"]')?.setAttribute('aria-labelledby', 'auth-modal-title');
            }}
            className="p-6 sm:p-8 relative overflow-hidden"
          >
            {/* Glow accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

            <ModalHeader id="auth-modal-title" className="p-0 mb-6">
              <div className="flex items-center justify-between w-full pr-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/30">
                    R
                  </div>
                  <div>
                    <h3 id="auth-modal-title" className="font-bold text-base text-white">
                      {mode === 'login' ? 'Masuk ke Rezekify' : 'Daftar Akun Baru'}
                    </h3>
                    <p className="text-xs text-slate-400">Autonomous Financial Runway Engine</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup modal autentikasi"
                  className="sr-only"
                >
                  Tutup modal autentikasi
                </button>
              </div>
            </ModalHeader>

            <ModalBody className="p-0">
              {/* Tabs */}
              <div className="flex bg-slate-950/70 p-1 rounded-xl mb-6 border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    mode === 'login'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    mode === 'register'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Daftar Akun</span>
                </button>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label htmlFor="auth-fullname" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nama Lengkap
                    </label>
                    <div className="relative flex items-center">
                      <UserIcon className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                      <input
                        id="auth-fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Contoh: Budi Santoso"
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 transition-all text-white"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Alamat Email
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 transition-all text-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Kata Sandi (Password)
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 transition-all text-white"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  color="primary"
                  isLoading={isLoading}
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 mt-6 active:scale-[0.99]"
                >
                  {isLoading ? (
                    <span>Memproses...</span>
                  ) : (
                    <span>{mode === 'login' ? 'Masuk Sekarang' : 'Daftar Akun'}</span>
                  )}
                </Button>
              </form>
            </ModalBody>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};
