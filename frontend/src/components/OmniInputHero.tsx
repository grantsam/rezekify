import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Sparkles, Camera, ArrowRight, Loader2, X, UploadCloud, AlertCircle, Mic, Square } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { compressImage } from '../utils/imageCompression';

interface Props {
  onSubmit:
    | ((text: string, file: File | null) => Promise<void> | void)
    | ((payload: { text: string; file: File | null }) => Promise<void> | void);
  isLoading: boolean;
  onVoiceSubmit?: (audioBlob: Blob, caption?: string) => Promise<void> | void;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const OmniInputHero: React.FC<Props> = ({ onSubmit, isLoading, onVoiceSubmit }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCancelledRef = useRef<boolean>(false);

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
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [previewUrl]);

  const handleFileSelection = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      setErrorMessage('Format file tidak didukung. Harap pilih gambar JPEG, PNG, atau WebP.');
      return;
    }
    setErrorMessage(null);
    setFile(selectedFile);
    try {
      const processed = await compressImage(selectedFile);
      setFile((current) => (current === selectedFile ? processed : current));
    } catch {
      // keep selectedFile
    }
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

  const submitData = () => {
    if ((!text.trim() && !file) || isLoading) return;
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitData();
  };

  const removeFile = () => {
    setErrorMessage(null);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartRecording = async () => {
    setErrorMessage(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Perekaman audio tidak didukung di browser ini.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      isCancelledRef.current = false;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setIsRecording(false);
        setRecordingDuration(0);

        if (isCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const chunks = audioChunksRef.current;
        if (chunks.length > 0) {
          const finalBlob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          audioChunksRef.current = [];
          if (onVoiceSubmit) {
            onVoiceSubmit(finalBlob, text.trim() || undefined);
          }
          setText('');
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      // ponytail: 60-second client-side audio auto-stop timer. Ceiling: single 60s hard stop. Upgrade to configurable duration or multi-part chunking only if long-form voice transcription (>1 minute) is required.
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          if (next >= 60) {
            setTimeout(() => handleStopRecording(), 0);
          }
          return next;
        });
      }, 1000);
    } catch {
      setErrorMessage('Izin mikrofon ditolak atau mikrofon tidak tersedia.');
    }
  };

  const handleStopRecording = () => {
    isCancelledRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancelRecording = () => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      let handled = false;
      if (isRecording) {
        handleCancelRecording();
        handled = true;
      }
      if (file) {
        removeFile();
        handled = true;
      }
      if (errorMessage) {
        setErrorMessage(null);
        handled = true;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (!isLoading && (text.trim() || file)) {
        submitData();
      }
    }
  };

  return (
    <div
      data-testid="omni-dropzone"
      onKeyDown={handleKeyDown}
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
      {isDraggingOver && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-slate-950/90 backdrop-blur-md border-2 border-dashed border-indigo-400 rounded-3xl pointer-events-none"
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 15px rgba(99, 102, 241, 0.4)',
                '0 0 35px rgba(99, 102, 241, 0.8)',
                '0 0 15px rgba(99, 102, 241, 0.4)',
              ],
              y: [-3, 3, -3],
            }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="p-3.5 bg-indigo-600/30 rounded-2xl border border-indigo-400/60"
          >
            <UploadCloud className="w-8 h-8 text-indigo-300" />
          </motion.div>
          <motion.p
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="text-sm md:text-base font-semibold text-indigo-200 text-center px-4"
          >
            Lepaskan foto struk belanja di sini...
          </motion.p>
        </motion.div>
      )}

      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <span className="text-xs md:text-sm font-semibold tracking-wider uppercase text-indigo-300">
            Rezekify AI Omni-Input (Pencatatan Otomatis)
          </span>
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Ketik santai, kirim pesan suara, atau unggah foto struk kasir
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
          <Button
            type="button"
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setErrorMessage(null)}
            aria-label="Tutup pesan kesalahan"
            className="p-1 rounded-lg hover:bg-rose-900/60 text-rose-300 hover:text-white transition-colors min-w-[38px] min-h-[38px] flex items-center justify-center bg-transparent"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {isRecording ? (
        <div
          role="region"
          aria-label="Perekaman suara aktif"
          className="relative flex items-center justify-between z-10 w-full bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3 shadow-inner"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-6 h-6">
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="w-6 h-6 rounded-full bg-rose-500/30 absolute"
              />
              <div className="w-3 h-3 rounded-full bg-rose-500 relative z-10" />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-sm md:text-base font-semibold text-rose-400 tabular-nums">
                {formatDuration(recordingDuration)} / 01:00
              </span>
              <div
                className="flex items-center gap-1 h-5 px-1"
                aria-label="Equalizer frekuensi suara"
                role="presentation"
              >
                {[0.35, 0.75, 0.45, 1.0, 0.6, 0.85, 0.4].map((heightScale, idx) => (
                  <motion.span
                    key={idx}
                    animate={{ scaleY: [heightScale, 1.0, 0.2, heightScale] }}
                    transition={{
                      repeat: Infinity,
                      repeatType: 'reverse',
                      duration: 0.5 + (idx % 4) * 0.15,
                      ease: 'easeInOut',
                      delay: idx * 0.06,
                    }}
                    className="w-1 h-4 bg-rose-500 rounded-full origin-center"
                  />
                ))}
              </div>
              <span className="text-xs md:text-sm text-slate-300 hidden sm:inline">
                Merekam suara...
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              isIconOnly
              size="sm"
              variant="flat"
              onPress={handleCancelRecording}
              aria-label="Batalkan rekaman"
              className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all"
              title="Batal"
            >
              <X className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              isIconOnly
              size="sm"
              variant="flat"
              onPress={handleStopRecording}
              aria-label="Selesai dan kirim pesan suara"
              className="min-w-[40px] min-h-[40px] p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl flex items-center justify-center transition-all shadow-md shadow-rose-600/30 active:scale-95"
              title="Selesai Merekam"
            >
              <Square className="w-4 h-4 fill-white" />
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleFormSubmit} className="relative flex items-center z-10">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Input pengeluaran santai atau instruksi AI"
            placeholder='Ketik pengeluaran santai, misal: "tadi jajan bakso 25rb pake gopay"...'
            disabled={isLoading}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-5 py-4 text-sm md:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 shadow-inner pr-44 transition-all"
          />
          <div className="absolute right-2.5 flex items-center gap-1.5 sm:gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
            <Button
              type="button"
              isIconOnly
              size="sm"
              variant="flat"
              aria-label="Pilih foto struk belanja"
              onPress={() => fileInputRef.current?.click()}
              className={`min-w-[40px] min-h-[40px] p-2.5 rounded-xl flex items-center justify-center transition-all ${
                file
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white bg-transparent'
              }`}
              title="Unggah Foto Struk Kasir"
            >
              <Camera className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              isIconOnly
              size="sm"
              variant="flat"
              aria-label="Rekam pesan suara"
              onPress={handleStartRecording}
              isDisabled={isLoading}
              disabled={isLoading}
              className="min-w-[40px] min-h-[40px] p-2.5 rounded-xl flex items-center justify-center transition-all hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 bg-transparent"
              title="Rekam Pesan Suara"
            >
              <Mic className="w-5 h-5" />
            </Button>
            <Button
              type="submit"
              isIconOnly
              size="sm"
              variant="flat"
              aria-label="Kirim"
              isDisabled={isLoading || (!text.trim() && !file)}
              disabled={isLoading || (!text.trim() && !file)}
              className="min-w-[40px] min-h-[40px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 active:scale-95"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            </Button>
          </div>
        </form>
      )}

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
          <Button
            type="button"
            isIconOnly
            size="sm"
            variant="light"
            onPress={removeFile}
            aria-label="Hapus lampiran struk"
            title="Hapus file"
            className="min-w-[38px] min-h-[38px] p-1.5 rounded-lg hover:bg-indigo-900/80 text-slate-300 hover:text-rose-400 transition-colors ml-2 flex items-center justify-center bg-transparent"
          >
            <X className="w-4 h-4" />
          </Button>
        </motion.div>
      )}
    </div>
  );
};
