import React from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import { Sparkles, ArrowUpRight, MessageSquare, Camera, Mic, Activity } from 'lucide-react';

interface AISpotlightHeroProps {
  onOpenChat: (prompt?: string) => void;
}

export const AISpotlightHero: React.FC<AISpotlightHeroProps> = ({ onOpenChat }) => {
  return (
    <Card className="w-full bg-white/80 dark:bg-[#141417] backdrop-blur-2xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[28px] shadow-lg shadow-black/5 transition-all overflow-hidden">
      <CardBody className="p-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-900/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Asisten AI Rezekify</h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Copilot
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium mt-0.5">
                Catat mutasi sekejap via teks santai, foto struk kasir, atau pesan suara.
              </p>
            </div>
          </div>

          <Button
            onPress={() => onOpenChat()}
            className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-900/20 min-h-[38px] px-5 py-2.5 shrink-0 self-end md:self-center transition-colors"
          >
            Buka AI Copilot
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Quick Prompts */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200/60 dark:border-zinc-800/80 text-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mr-1">
            COBA:
          </span>
          <button
            onClick={() => onOpenChat('Makan siang 35rb Gopay')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-zinc-900/60 hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800/80 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
            <span>Makan siang 35rb Gopay</span>
          </button>
          <button
            onClick={() => onOpenChat('Unggah struk kasir')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-zinc-900/60 hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800/80 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-500" />
            <span>Unggah struk kasir</span>
          </button>
          <button
            onClick={() => onOpenChat('Catat via pesan suara')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-zinc-900/60 hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800/80 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
          >
            <Mic className="w-3.5 h-3.5 text-emerald-500" />
            <span>Catat via pesan suara</span>
          </button>
          <button
            onClick={() => onOpenChat('Cek jatah aman hari ini')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-zinc-900/60 hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800/80 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Cek jatah aman hari ini</span>
          </button>
        </div>
      </CardBody>
    </Card>
  );
};