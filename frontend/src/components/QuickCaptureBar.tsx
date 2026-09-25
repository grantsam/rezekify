import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@heroui/react';
import {
  Terminal,
  Camera,
  Mic,
  Square,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '../utils/imageCompression';

export interface QuickCaptureBarProps {
  onSubmit: (input: string | { text: string; file: File | null }, file?: File | null) => Promise<void> | void;
  onVoiceSubmit: (blob: Blob, caption?: string) => Promise<void> | void;
  isLoading?: boolean;
  toastMessage?: { text: string; isError?: boolean } | null;
  onDismissToast?: () => void;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const QuickCaptureBar: React.FC<QuickCaptureBarProps> = ({
  onSubmit,
  onVoiceSubmit,
  isLoading = false,
  toastMessage = null,
  onDismissToast,
}) => {
  const [text, setText] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toastMessage || !onDismissToast) return;
    const timer = setTimeout(() => {
      onDismissToast();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastMessage, onDismissToast]);

  // Clean up media resources on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const formatDuration = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      return;
    }
    setFile(selectedFile);
    try {
      const compressed = await compressImage(selectedFile);
      setFile((current) => (current === selectedFile ? compressed : current));
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
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const submitPayload = () => {
    const trimmed = text.trim();
    if (!trimmed && !file) return;
    if (isLoading) return;

    if (onSubmit.length === 2) {
      (onSubmit as (t: string, f: File | null) => void)(trimmed, file);
    } else {
      (onSubmit as (p: { text: string; file: File | null }) => void)({ text: trimmed, file });
    }

    setText('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitPayload();
    }
  };

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
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

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (audioBlob.size > 0) {
          onVoiceSubmit(audioBlob, text.trim() || undefined);
        }
        cleanupRecordingState();
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      cleanupRecordingState();
    }
  };

  const cleanupRecordingState = () => {
    setIsRecording(false);
    setRecordingSeconds(0);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancelRecording = () => {
    audioChunksRef.current = [];
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
    cleanupRecordingState();
  };

  return (
    <div
      className="relative w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Sleek 44px Command Strip */}
      <div
        className={`h-11 rounded-xl bg-[#141417] border px-3 flex items-center gap-2.5 transition-all ${
          isDraggingOver
            ? 'border-zinc-500 bg-zinc-900/80 ring-1 ring-zinc-500'
            : isRecording
            ? 'border-rose-500/50 bg-rose-950/20'
            : 'border-zinc-800/80 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600'
        }`}
      >
        {isRecording ? (
          <div
            role="region"
            aria-label="Perekaman suara aktif"
            className="flex-1 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <span className="text-xs font-mono font-medium text-rose-400 tabular-nums">
                {formatDuration(recordingSeconds)}
              </span>
              {/* 5 Equalizer frequency bars */}
              <div className="flex items-center gap-1 h-4 px-1" aria-hidden="true">
                {[0.4, 0.9, 0.5, 1.0, 0.6].map((scale, idx) => (
                  <motion.span
                    key={idx}
                    animate={{ scaleY: [scale, 1.0, 0.2, scale] }}
                    transition={{
                      repeat: Infinity,
                      repeatType: 'reverse',
                      duration: 0.25,
                      ease: 'easeInOut',
                    }}
                    className="w-1 h-3.5 bg-rose-500 rounded-full origin-center"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleCancelRecording}
                aria-label="Batalkan rekaman"
                className="p-1 min-w-[32px] min-h-[32px] text-zinc-400 hover:text-white bg-transparent"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                isIconOnly
                size="sm"
                onPress={handleStopRecording}
                aria-label="Selesai dan kirim pesan suara"
                className="min-w-[32px] min-h-[32px] bg-rose-600 hover:bg-rose-500 text-white rounded-lg flex items-center justify-center"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Terminal className="w-4 h-4 text-zinc-500 shrink-0" />

            {/* Attached receipt chip preview */}
            {file && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700/80 text-xs text-zinc-300 shrink-0 max-w-[140px] sm:max-w-[200px] truncate">
                <span className="truncate">{file.name}</span>
                <Button
                  type="button"
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  aria-label="Hapus struk"
                  className="text-zinc-400 hover:text-white ml-0.5 min-w-[20px] w-5 h-5 p-0 bg-transparent"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ketik mutasi, drop foto struk kasir, atau rekam suara..."
              className="bg-transparent flex-1 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none min-w-0"
            />

            <div className="flex items-center gap-1 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="hidden"
              />

              <Button
                type="button"
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => fileInputRef.current?.click()}
                isDisabled={isLoading}
                aria-label="Pilih struk belanja"
                className="p-1 min-w-[34px] min-h-[34px] text-zinc-400 hover:text-zinc-200 bg-transparent rounded-lg"
              >
                <Camera className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleStartRecording}
                isDisabled={isLoading}
                aria-label="Rekam pesan suara"
                className="p-1 min-w-[34px] min-h-[34px] text-zinc-400 hover:text-zinc-200 bg-transparent rounded-lg"
              >
                <Mic className="w-4 h-4" />
              </Button>

              {isLoading ? (
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin ml-1" />
              ) : (
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-[10px] text-zinc-400 font-mono ml-1">
                  Ctrl ↵
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Notification Toast (Bottom-Right) */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-20 md:bottom-6 right-6 z-50 p-4 rounded-xl border flex items-start gap-3 shadow-xl max-w-sm sm:max-w-md ${
              toastMessage.isError
                ? 'bg-[#181014] border-rose-500/30 text-rose-300'
                : 'bg-[#101714] border-emerald-500/30 text-emerald-300'
            }`}
          >
            {toastMessage.isError ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs sm:text-sm">
              <p className="font-semibold text-[11px] uppercase tracking-wider text-zinc-400 mb-0.5">
                {toastMessage.isError ? 'Gagal Memproses' : 'Hasil Konfirmasi AI'}
              </p>
              <p className="text-zinc-200 whitespace-pre-line">{toastMessage.text}</p>
            </div>
            {onDismissToast && (
              <Button
                type="button"
                isIconOnly
                size="sm"
                variant="light"
                onPress={onDismissToast}
                aria-label="Tutup notifikasi"
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/40 min-w-[28px] w-7 h-7 bg-transparent"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
