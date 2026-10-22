import { useState, useRef } from 'react';

export default function FeaturesSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const features = [
    {
      id: 'scan-struk',
      title: 'Scan Struk (OCR + AI)',
      description: 'Foto struk belanjaanmu dan biarkan AI mengekstrak item serta nominalnya secara instan.',
      badge: 'Otomatis',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4 7v-1a2 2 0 0 1 2 -2h2" />
          <path d="M4 17v1a2 2 0 0 0 2 2h2" />
          <path d="M16 4h2a2 2 0 0 1 2 2v1" />
          <path d="M16 20h2a2 2 0 0 0 2 -2v-1" />
          <path d="M5 12l14 0" />
        </svg>
      ),
    },
    {
      id: 'kategori-otomatis',
      title: 'Kategori Otomatis',
      description: 'Pengelompokan pengeluaran otomatis seperti Makanan, Transport, dan Hiburan tanpa input manual.',
      badge: 'Cerdas',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4 4h6v6h-6z" />
          <path d="M14 4h6v6h-6z" />
          <path d="M4 14h6v6h-6z" />
          <path d="M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
        </svg>
      ),
    },
    {
      id: 'prediksi-keuangan',
      title: 'Prediksi Keuangan',
      description: 'Analisis kecerdasan buatan yang memprediksi kondisi arus kas kamu akhir bulan.',
      badge: 'AI Insight',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 17l6 -6l4 4l8 -8" />
          <path d="M14 7l7 0l0 7" />
        </svg>
      ),
    },
    {
      id: 'notifikasi-reminder',
      title: 'Notifikasi & Reminder',
      description: 'Peringatan dini jika pengeluaran sudah mendekati batas anggaran bulanan.',
      badge: 'Realtime',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3l1 2h-16l1 -2v-3a7 7 0 0 1 4 -6" />
          <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
        </svg>
      ),
    },
    {
      id: 'laporan-keuangan',
      title: 'Laporan Keuangan',
      description: 'Visualisasi grafik dompet dan tren cashflow yang mudah dipahami dalam sekali pandang.',
      badge: 'Visual',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 3v18h18" />
          <path d="M18 9l-5 10l-4 -4l-4 4" />
        </svg>
      ),
    },
    {
      id: 'multi-akun',
      title: 'Multi Akun',
      description: 'Kelola berbagai dompet digital, rekening bank, dan kas tunai dalam satu dashboard.',
      badge: 'Fleksibel',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" />
          <path d="M3 10h18" />
          <path d="M7 15h.01" />
          <path d="M11 15h2" />
        </svg>
      ),
    },
  ];

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section id="fitur" className="relative py-16 lg:py-24 overflow-hidden select-none transition-colors duration-300">
      
      <div className="absolute top-1/2 left-[-5%] -translate-y-1/2 w-[600px] h-[600px] bg-radial from-[#10B981]/15 via-[#0F766E]/10 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[600px] h-[600px] bg-radial from-[#34D399]/15 via-[#0F766E]/15 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[310px] sm:max-w-[330px] transition-transform duration-500 hover:scale-[1.02]">
              
              <div className="absolute inset-0 bg-gradient-to-tr from-[#0F766E]/40 to-[#10B981]/30 rounded-[48px] blur-2xl -z-10 animate-pulse duration-[5000ms]" />

              <div className="relative rounded-[40px] p-4 bg-white/70 dark:bg-[#141417] backdrop-blur-2xl border-4 border-white/80 dark:border-zinc-800/80 shadow-2xl shadow-black/15 space-y-4">

                <div className="flex items-center justify-between px-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
                    <span className="text-[11px] font-bold text-slate-800 dark:text-white">Rezekify App</span>
                  </div>
                  <div className="w-12 h-3 rounded-full bg-slate-300/60 dark:bg-slate-700/60" />
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0F766E] to-[#10B981] text-white shadow-lg space-y-2">
                  <p className="text-[10px] font-medium opacity-80 uppercase tracking-wider">Total Saldo Terkelola</p>
                  <p className="text-xl font-black tabular-nums">Rp 5.250.000</p>

                  <div className="pt-2 flex justify-between items-center text-[10px] opacity-90 border-t border-white/20">
                    <span>Pemasukan: <strong className="text-emerald-200">Rp 3.500.000</strong></span>
                    <span>Pengeluaran: <strong className="text-rose-200">Rp 2.150.000</strong></span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-[#141417]/80 border border-white/80 dark:border-zinc-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#10B981]/20 text-[#10B981] flex items-center justify-center font-bold text-xs">
                      📷
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800 dark:text-white">AI OCR Scanner Active</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">Mengekstrak Struk Belanja...</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-full">
                    99.8%
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-[#141417]/80 border border-white/80 dark:border-zinc-800/80 space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    <span>Cashflow Bulanan</span>
                    <span className="text-[#10B981]">+18% Stabil</span>
                  </div>
                  <div className="flex items-end gap-1.5 h-16 pt-2">
                    <div className="w-full bg-[#10B981]/20 rounded-t-sm h-[40%] hover:h-[70%] transition-all" />
                    <div className="w-full bg-[#10B981]/40 rounded-t-sm h-[65%] hover:h-[80%] transition-all" />
                    <div className="w-full bg-[#10B981] rounded-t-sm h-[90%] hover:h-[100%] transition-all" />
                    <div className="w-full bg-[#10B981]/30 rounded-t-sm h-[50%] hover:h-[60%] transition-all" />
                    <div className="w-full bg-[#0F766E] rounded-t-sm h-[75%] hover:h-[85%] transition-all" />
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6 text-left">

            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10B981]/15 dark:bg-[#10B981]/20 border border-[#10B981]/30 text-[#0F766E] dark:text-[#10B981] text-xs font-bold tracking-wide backdrop-blur-md shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                Fitur Unggulan
              </div>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight leading-[1.35] text-slate-900 dark:text-white">
              Teknologi Canggih untuk <br className="hidden sm:block" />
              <span className="text-emerald-500 dark:text-emerald-400">Pengelolaan Keuangan</span> yang Lebih Baik
            </h2>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              Rezekify dilengkapi dengan fitur-fitur modern yang dirancang untuk memudahkan kamu dalam mengelola keuangan pribadi secara intuitif.
            </p>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Geser untuk jelajahi fitur (1/6)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleScroll('left')}
                  className="w-10 h-10 rounded-full bg-white/60 dark:bg-[#141417]/90 border border-slate-200 dark:border-zinc-800/80 text-slate-700 dark:text-slate-200 hover:bg-[#10B981] hover:text-white transition-all flex items-center justify-center shadow-sm"
                  aria-label="Previous Feature"
                >
                  ←
                </button>
                <button
                  onClick={() => handleScroll('right')}
                  className="w-10 h-10 rounded-full bg-white/60 dark:bg-[#141417]/90 border border-slate-200 dark:border-zinc-800/80 text-slate-700 dark:text-slate-200 hover:bg-[#10B981] hover:text-white transition-all flex items-center justify-center shadow-sm"
                  aria-label="Next Feature"
                >
                  →
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none scroll-smooth"
            >
              {features.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`snap-start shrink-0 w-[280px] sm:w-[320px] p-6 rounded-3xl bg-white/50 dark:bg-[#141417] backdrop-blur-2xl border transition-all duration-300 text-left flex flex-col justify-between cursor-pointer ${
                    activeIdx === idx
                      ? 'border-[#10B981] shadow-xl shadow-black/15 -translate-y-1'
                      : 'border-white/80 dark:border-zinc-800/80 hover:border-zinc-700/60'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#10B981]/20 to-[#0F766E]/10 text-[#0F766E] dark:text-[#10B981] border border-[#10B981]/20 flex items-center justify-center">
                        {item.icon}
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#0F766E] dark:text-[#10B981]">
                        {item.badge}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}