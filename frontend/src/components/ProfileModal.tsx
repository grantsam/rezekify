import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { User as UserIcon, Mail, Send, KeyRound, ShieldCheck } from 'lucide-react';
import { User } from '../types/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUpdateProfile?: (updatedData: Partial<User>) => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateProfile,
}) => {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [telegramId, setTelegramId] = useState<string>(
    user?.telegram_chat_id != null ? String(user.telegram_chat_id) : ''
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name || '');
    setTelegramId(user?.telegram_chat_id != null ? String(user.telegram_chat_id) : '');
  }, [user]);

  const handleSave = async () => {
    if (!onUpdateProfile) return;
    setIsLoading(true);
    try {
      const parsedTelegramId = telegramId.trim() !== '' ? Number(telegramId) : null;
      await onUpdateProfile({
        full_name: fullName,
        telegram_chat_id: isNaN(parsedTelegramId as number) ? null : parsedTelegramId,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      classNames={{
        base: 'bg-white/95 dark:bg-[#141417] backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[28px] shadow-2xl text-slate-900 dark:text-white max-w-md mx-4 select-none',
        header: 'border-b border-slate-200/80 dark:border-zinc-800/80 pb-4',
        footer: 'border-t border-slate-200/80 dark:border-zinc-800/80 pt-4',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0F766E] to-[#10B981] text-white flex items-center justify-center font-extrabold shadow-md shadow-emerald-900/20 shrink-0">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Profil Pengguna</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Kelola data akun & integrasi Rezekify Anda
            </p>
          </div>
        </ModalHeader>

        <ModalBody className="py-6 space-y-4 text-left">
          {/* Field: Nama Lengkap */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Nama Lengkap
            </label>
            <div className="relative flex items-center">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Masukkan nama lengkap Anda"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
              />
            </div>
          </div>

          {/* Field: Alamat Email (Disabled) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Alamat Email
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-100 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-75"
              />
            </div>
          </div>

          {/* Field: Telegram Chat ID */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Telegram Chat ID
            </label>
            <div className="relative flex items-center">
              <Send className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Contoh: 123456789"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#0c0c0e] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
              Diperlukan untuk menerima alert otomatis dan input via bot Telegram
            </p>
          </div>

          {/* Status Otentikasi Box */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 mt-2">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-extrabold text-slate-800 dark:text-white">Status Otentikasi</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Sesi terenkripsi & aktif</p>
              </div>
            </div>
            <Button size="sm" variant="flat" className="text-xs font-bold rounded-xl bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 min-h-[32px]">
              <KeyRound className="w-3.5 h-3.5 mr-1" />
              Ganti Password
            </Button>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={onClose} className="rounded-xl font-bold text-xs">
            Batal
          </Button>
          <Button
            isLoading={isLoading}
            onPress={handleSave}
            className="bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-900/20 px-5"
          >
            Simpan Perubahan
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};