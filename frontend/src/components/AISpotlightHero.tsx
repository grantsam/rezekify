import React from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import { Sparkles, ArrowRight } from 'lucide-react';

export interface AISpotlightHeroProps {
  onOpenChat: (initialPrompt?: string) => void;
}

const PROMPT_SUGGESTIONS = [
  '🍜 Makan siang 35rb Gopay',
  '📸 Unggah struk kasir',
  '🎙️ Catat via pesan suara',
  '📊 Cek jatah aman hari ini',
];

// ponytail: spotlight hero banner for AI copilot with quick prompt suggestions; upgrade with context-aware prompts based on monthly runway or unbudgeted alerts if telemetry rules expand.
export const AISpotlightHero: React.FC<AISpotlightHeroProps> = ({ onOpenChat }) => {
  return (
    <Card className="bg-[#141417] border border-zinc-800/80 hover:border-zinc-700/80 transition-colors rounded-2xl shadow-none relative overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 w-56 h-56 bg-emerald-500/5 rounded-full blur-2xl"
        aria-hidden="true"
      />

      <CardBody className="p-5 relative z-10 flex flex-col gap-4">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shrink-0 text-emerald-400 mt-0.5 sm:mt-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                  Asisten AI Rezekify
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Copilot
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mt-1">
                Catat mutasi sekejap via teks santai, foto struk kasir, atau pesan suara.
              </p>
            </div>
          </div>

          <Button
            color="primary"
            onPress={() => onOpenChat()}
            endContent={<ArrowRight className="w-4 h-4" />}
            className="font-semibold text-xs sm:text-sm py-2 px-4 min-h-[38px] sm:min-h-[44px] rounded-xl shrink-0 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-md shadow-emerald-500/10 transition-colors"
          >
            Buka AI Copilot
          </Button>
        </div>

        {/* Quick Prompt Suggestion Chips */}
        <div className="pt-1 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mr-1 select-none">
            Coba:
          </span>
          {PROMPT_SUGGESTIONS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onOpenChat(prompt)}
              className="inline-flex items-center px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {prompt}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
};
