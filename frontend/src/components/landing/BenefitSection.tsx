import { useState } from 'react';
import { Zap, ShieldCheck, TrendingUp, Target, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCountUp } from '../../hooks/useCountUp';

export default function BenefitsSection() {
  const [activeTab, setActiveTab] = useState(0);

  const countHemat = useCountUp(85, { suffix: '%' });
  const countKontrol = useCountUp(100, { suffix: '%' });
  const countKeputusan = useCountUp(3.5, { decimals: 1, suffix: 'x' });
  const countTujuan = useCountUp(2, { suffix: 'x Lipat' });

  const benefits = [
    {
      id: 'hemat-waktu',
      number: '01',
      title: 'Hemat Waktu',
      shortDesc: 'Pencatatan otomatis & terstruktur dalam hitungan detik.',
      fullDesc: 'Tidak perlu lagi mencatat transaksi manual satu per satu. Teknologi AI OCR akan memproses foto struk belanja dan memindahkan data transaksi secara otomatis.',
      highlightVal: countHemat.count,
      highlightRef: countHemat.ref,
      highlightLabel: 'Waktu Pencatatan Terhemat',
      metricIcon: <Zap className="w-6 h-6 text-white" />,
      icon: <Clock className="w-5 h-5" />,
    },
    {
      id: 'kontrol-penuh',
      number: '02',
      title: 'Kontrol Penuh',
      shortDesc: 'Atur keuangan sesuai tujuan dan batasan anggaranmu.',
      fullDesc: 'Kuasai alur pengeluaran dengan batasan budget bulanan yang fleksibel serta notifikasi peringatan otomatis sebelum anggaran kamu membengkak.',
      highlightVal: countKontrol.count,
      highlightRef: countKontrol.ref,
      highlightLabel: 'Transparansi Cashflow',
      metricIcon: <ShieldCheck className="w-6 h-6 text-white" />,
      icon: <ShieldCheck className="w-5 h-5" />,
    },
    {
      id: 'keputusan-lebih-baik',
      number: '03',
      title: 'Keputusan Lebih Baik',
      shortDesc: 'Berdasarkan data histori & insight AI yang akurat.',
      fullDesc: 'Ambil langkah finansial yang bijak berdasarkan analisa kebiasaan belanja dan proyeksi rasio kecukupan tabungan dari asisten kecerdasan buatan.',
      highlightVal: countKeputusan.count,
      highlightRef: countKeputusan.ref,
      highlightLabel: 'Keputusan Lebih Terarah',
      metricIcon: <TrendingUp className="w-6 h-6 text-white" />,
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      id: 'raih-tujuan-finansial',
      number: '04',
      title: 'Raih Tujuan Finansial',
      shortDesc: 'Wujudkan tabungan, investasi, dan mimpi masa depan.',
      fullDesc: 'Capai target impian seperti liburan, pembelian kendaraan, hingga dana darurat dengan tracker progress tabungan interaktif yang konsisten.',
      highlightVal: countTujuan.count,
      highlightRef: countTujuan.ref,
      highlightLabel: 'Target Finansial Lebih Cepat',
      metricIcon: <Target className="w-6 h-6 text-white" />,
      icon: <Target className="w-5 h-5" />,
    },
  ];

  const current = benefits[activeTab];

  return (
    <section id="manfaat" className="relative py-16 lg:py-24 overflow-hidden select-none transition-colors duration-300">

      <div className="absolute top-1/2 left-[-5%] -translate-y-1/2 w-[600px] h-[600px] bg-radial from-emerald-500/25 via-teal-600/15 to-transparent rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[600px] h-[600px] bg-radial from-emerald-400/20 via-teal-600/20 to-transparent rounded-full blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">

          <div className="lg:col-span-6 flex flex-col justify-between space-y-6 text-left">

            <div className="space-y-4">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 text-teal-700 dark:text-emerald-400 text-xs font-bold tracking-wide backdrop-blur-md shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Manfaat untuk Kamu
                </div>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight leading-[1.3] text-slate-900 dark:text-white">
                Lebih dari Sekadar Mencatat, <br />
                Ini tentang <span className="text-emerald-500 dark:text-emerald-400">Masa Depan Finansialmu</span>
              </h2>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                Dengan Rezekify, kamu tidak hanya mengelola uang, tetapi juga membangun kebiasaan finansial yang lebih baik dan terencana.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {benefits.map((item, idx) => {
                const isActive = activeTab === idx;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveTab(idx)}
                    className={`p-3.5 sm:p-4 rounded-2xl cursor-pointer backdrop-blur-2xl border transition-all duration-300 flex items-center gap-3.5 ${
                      isActive
                        ? 'bg-teal-600/15 dark:bg-teal-600/30 border-emerald-500 shadow-lg shadow-emerald-500/15 translate-x-1.5'
                        : 'bg-white/40 dark:bg-[#141417]/50 border-white/40 dark:border-zinc-800/80 hover:border-zinc-700/60 hover:bg-zinc-800/20'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-teal-600 to-emerald-500 text-white shadow-md shadow-emerald-500/30'
                        : 'bg-emerald-500/15 text-teal-700 dark:text-emerald-400'
                    }`}>
                      {item.icon}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h3>
                        <span className={`text-xs font-extrabold ${isActive ? 'text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {item.number}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-300 line-clamp-1 mt-0.5 font-normal">
                        {item.shortDesc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          <div className="lg:col-span-6 flex">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full min-h-[380px] bg-teal-600/10 dark:bg-[#141417] backdrop-blur-3xl border border-white/50 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/10 flex flex-col justify-between text-left transition-all duration-500 relative overflow-hidden"
              >

                <div className="absolute -top-16 -right-16 w-36 h-36 bg-gradient-to-br from-white/30 dark:from-emerald-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />

                <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-zinc-800/80 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                        Fokus Manfaat {current.number}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/20">
                      Analisis Rezekify
                    </span>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                      {current.title}
                    </h3>

                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                      {current.fullDesc}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-500/10 dark:bg-zinc-900/60 backdrop-blur-xl border border-white/40 dark:border-zinc-800/80 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white flex items-center justify-center text-2xl shadow-md shrink-0">
                      {current.metricIcon}
                    </div>
                    <div>
                      <p ref={current.highlightRef} className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                        {current.highlightVal}
                      </p>
                      <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        {current.highlightLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 p-4 rounded-2xl bg-emerald-500/10 dark:bg-zinc-900/60 backdrop-blur-xl border border-white/40 dark:border-zinc-800/80 space-y-3 relative z-10">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>Proyeksi Dampak Keuangan</span>
                    <span className="text-emerald-400">Terverifikasi AI</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
                      <span>Efisiensi Pengelolaan</span>
                      <span className="font-bold text-emerald-400">+38%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900/10 dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-teal-600 to-emerald-500 rounded-full w-[82%] transition-all duration-700" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
                      <span>Konsistensi Tabungan</span>
                      <span className="font-bold text-emerald-400">94%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900/10 dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full w-[94%] transition-all duration-700" />
                    </div>
                  </div>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

        </div>

      </div>
    </section>
  );
}
