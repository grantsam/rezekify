import React, { useState, useRef } from 'react';
import { Sparkles, Camera, ArrowRight, Loader2, Image as ImageIcon } from 'lucide-react';

interface Props {
  onSubmit: (text: string, file: File | null) => void;
  isLoading: boolean;
}

export const OmniInputHero: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file) return;
    onSubmit(text, file);
    setText('');
    setFile(null);
  };

  return (
    <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 p-6 md:p-8 rounded-3xl shadow-2xl border border-indigo-500/25 text-white mb-8 relative overflow-hidden">
      {/* Ambient background accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
          <span className="text-xs md:text-sm font-semibold tracking-wider uppercase text-indigo-300">
            Rezekify AI Omni-Input (Pencatatan Otomatis)
          </span>
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Teks Bebas &middot; Foto Struk &middot; Multimodal OCR
        </span>
      </div>

      <form onSubmit={handleFormSubmit} className="relative flex items-center z-10">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Ketik pengeluaran santai, misal: "tadi jajan bakso 25rb pake gopay"...'
          disabled={isLoading}
          className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-5 py-4 text-sm md:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 shadow-inner pr-32 transition-all"
        />
        <div className="absolute right-2.5 flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-2.5 rounded-xl transition-all ${
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
            disabled={isLoading || (!text.trim() && !file)}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 active:scale-95"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </form>

      {file && (
        <div className="mt-3 text-xs text-indigo-300 flex items-center gap-2 bg-indigo-950/60 border border-indigo-500/30 px-3 py-1.5 rounded-lg w-fit">
          <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Struk terlampir: <strong className="text-white">{file.name}</strong></span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="text-rose-400 hover:underline ml-1 font-semibold"
          >
            Hapus
          </button>
        </div>
      )}
    </div>
  );
};
