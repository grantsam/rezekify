import React, { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Paperclip, Mic, Square, X, Loader2, Send } from 'lucide-react';
import { compressImage } from '../utils/imageCompression';

export interface ChatOmniInputProps {
  onSubmit: (text: string, file: File | null) => Promise<void> | void;
  onVoiceSubmit: (blob: Blob, caption?: string) => Promise<void> | void;
  isLoading?: boolean;
  placeholder?: string;
  initialPrompt?: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ChatOmniInput: React.FC<ChatOmniInputProps> = ({
  onSubmit,
  onVoiceSubmit,
  isLoading = false,
  placeholder,
  initialPrompt,
}) => {
  const [text, setText] = useState<string>(initialPrompt || '');
  const [file, setFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Sync initialPrompt changes into input text
  useEffect(() => {
    if (initialPrompt !== undefined) {
      setText(initialPrompt);
    }
  }, [initialPrompt]);

  // Auto-resize textarea height between 44px and 160px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const targetHeight = Math.min(Math.max(scrollHeight, 44), 160);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [text]);

  // Clean up media stream and timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
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
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) return;

    setFile(selectedFile);
    try {
      const compressed = await compressImage(selectedFile);
      setFile((current) => (current === selectedFile ? compressed : current));
    } catch {
      // Retain original file on compression error
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

  const handleSubmit = () => {
    const trimmed = text.trim();
    if ((!trimmed && !file) || isLoading) return;

    onSubmit(trimmed, file);
    setText('');
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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

  const isSubmitDisabled = isLoading || (!text.trim() && !file);

  return (
    <div
      data-testid="chat-omni-input-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full rounded-2xl border transition-all duration-200 select-none ${
        isDraggingOver
          ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
          : isRecording
          ? 'border-rose-500/50 bg-rose-500/10'
          : 'border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-[#141417] backdrop-blur-xl focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600 shadow-lg shadow-black/5'
      }`}
    >
      {/* Voice recording state view */}
      {isRecording ? (
        <div
          role="region"
          aria-label="Perekaman suara aktif"
          className="flex items-center justify-between p-3 min-h-[56px]"
        >
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span className="text-xs font-mono font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
              {formatDuration(recordingSeconds)}
            </span>
            {/* Visualizer bars */}
            <div className="flex items-center gap-1 h-4 px-1" aria-hidden="true">
              {[0.4, 0.9, 0.5, 1.0, 0.6].map((scale, idx) => (
                <motion.span
                  key={idx}
                  animate={
                    shouldReduceMotion
                      ? { scaleY: scale }
                      : { scaleY: [scale, 1.0, 0.2, scale] }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : {
                          repeat: Infinity,
                          repeatType: 'reverse',
                          duration: 0.25,
                          ease: 'easeInOut',
                        }
                  }
                  className="w-1 h-3.5 bg-rose-500 rounded-full origin-center"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancelRecording}
              aria-label="Batalkan rekaman"
              className="min-w-[36px] min-h-[36px] p-2 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleStopRecording}
              aria-label="Selesai dan kirim pesan suara"
              className="min-w-[36px] min-h-[36px] px-3.5 py-1.5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Selesai</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col p-2.5 gap-2 text-left">
          {/* Attached receipt / image chip preview */}
          {file && (
            <div className="flex items-center gap-2 self-start px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span className="max-w-[240px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                aria-label="Hapus lampiran"
                className="p-1 min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Auto-growing Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={placeholder || 'Tanya atau catat keuangan... (Shift+Enter untuk baris baru)'}
            aria-label="Pesan chat keuangan"
            className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-none resize-none min-h-[44px] max-h-[160px] py-1.5 px-2 overflow-y-auto leading-relaxed"
          />

          {/* Bottom actions toolbar */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 dark:border-zinc-800/80">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                aria-label="Unggah struk atau gambar"
                title="Unggah struk atau gambar (JPEG, PNG, WebP)"
                className="min-w-[36px] min-h-[36px] p-2 inline-flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleStartRecording}
                disabled={isLoading}
                aria-label="Rekam pesan suara"
                title="Rekam pesan suara mutasi atau pertanyaan"
                className="min-w-[36px] min-h-[36px] p-2 inline-flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              aria-label="Kirim pesan"
              title="Kirim pesan (Enter)"
              className="min-w-[38px] min-h-[38px] p-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 text-white font-extrabold active:scale-95 transition-all shadow-md shadow-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};