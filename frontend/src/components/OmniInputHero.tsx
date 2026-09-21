import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Sparkles, Camera, ArrowRight, Loader2, X, UploadCloud, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onSubmit:
    | ((text: string, file: File | null) => Promise<void> | void)
    | ((payload: { text: string; file: File | null }) => Promise<void> | void);
  isLoading: boolean;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const OmniInputHero: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelection = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      setErrorMessage('Format file tidak didukung. Harap pilih gambar JPEG, PNG, atau WebP.');
      return;
    }
    setErrorMessage(null);
    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file) return;
    setErrorMessage(null);
    const trimmed = text.trim();
    if (onSubmit.length === 1) {
      (onSubmit as (p: { text: string; file: File | null }) => void)({ text: trimmed, file });
    } else {
      (onSubmit as (t: string, f: File | null) => void)(trimmed, file);
    }
    setText('');
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = () => {
    setErrorMessage(null);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      data-testid="omni-dropzone"
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-6 md:p-8 rounded-3xl shadow-2xl transition-all mb-8 relative overflow-hidden text-white ${
        isDraggingOver
          ? 'bg-indigo-950/80 border-2 border-dashed border-indigo-400 shadow-indigo-500/20 scale-[1.01]'
          : 'bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/25'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <span className="text-xs md:text-sm font-semibold tracking-wider uppercase text-indigo-300">
            Rezekify AI Omni-Input (Pencatatan Otomatis)
          </span>
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Ketik santai atau unggah foto struk kasir
        </span>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between gap-2 bg-rose-950/80 border border-rose-500/40 text-rose-200 px-3.5 py-2.5 rounded-xl text-xs relative z-10"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            aria-label="Tutup pesan kesalahan"
            className="p-1 rounded-lg hover:bg-rose-900/60 text-rose-300 hover:text-white transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="relative flex items-center z-10">
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          aria-label="Input pengeluaran santai atau instruksi AI"
          placeholder='Ketik pengeluaran santai, misal: "tadi jajan bakso 25rb pake gopay"...'
          disabled={isLoading}
          className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-5 py-4 text-sm md:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 shadow-inner pr-32 transition-all"
        />
        <div className="absolute right-2.5 flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
          <button
            type="button"
            aria-label="Pilih foto struk belanja"
            onClick={() => fileInputRef.current?.click()}
            className={`min-w-[40px] min-h-[40px] p-2.5 rounded-xl flex items-center justify-center transition-all ${
              file
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Unggah Foto Struk Kasir"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            type="submit"
            aria-label="Kirim"
            disabled={isLoading || (!text.trim() && !file)}
            className="min-w-[40px] min-h-[40px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 active:scale-95"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </form>

      {file && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="mt-3 flex items-center gap-3 bg-indigo-950/70 border border-indigo-500/40 px-3 py-2 rounded-xl w-fit relative z-10 shadow-lg"
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Pratinjau Struk"
              className="w-10 h-10 object-cover rounded-lg border border-indigo-400/40 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-indigo-900/60 rounded-lg flex items-center justify-center shrink-0">
              <UploadCloud className="w-5 h-5 text-indigo-300" />
            </div>
          )}
          <div className="text-xs">
            <p className="font-semibold text-white max-w-[200px] truncate">{file.name}</p>
            <p className="text-[11px] text-indigo-300">{(file.size / 1024).toFixed(0)} KB &middot; Siap diproses</p>
          </div>
          <button
            type="button"
            onClick={removeFile}
            aria-label="Hapus lampiran struk"
            title="Hapus file"
            className="min-w-[36px] min-h-[36px] p-1.5 rounded-lg hover:bg-indigo-900/80 text-slate-300 hover:text-rose-400 transition-colors ml-2 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
};
