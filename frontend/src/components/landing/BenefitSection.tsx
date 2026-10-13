import { useState } from 'react';

export default function BenefitsSection() {
  const [activeTab, setActiveTab] = useState(0);

  const benefits = [
    {
      id: 'hemat-waktu',
      number: '01',
      title: 'Hemat Waktu',
      shortDesc: 'Pencatatan otomatis & terstruktur dalam hitungan detik.',
      fullDesc: 'Tidak perlu lagi mencatat transaksi manual satu per satu. Teknologi AI OCR akan memproses foto struk belanja dan memindahkan data transaksi secara otomatis.',
      highlightVal: '85%',
      highlightLabel: 'Waktu Pencatatan Terhemat',
      metricIcon: '⚡',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 8v4l3 3" />
          <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
        </svg>
      ),
    },
    {
      id: 'kontrol-penuh',
      number: '02',
      title: 'Kontrol Penuh',
      shortDesc: 'Atur keuangan sesuai tujuan dan batasan anggaranmu.',
      fullDesc: 'Kuasai alur pengeluaran dengan batasan budget bulanan yang fleksibel serta notifikasi peringatan otomatis sebelum anggaran kamu membengkak.',
      highlightVal: '100%',
      highlightLabel: 'Transparansi Cashflow',
      metricIcon: '🛡️',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -3.5 9a12 12 0 0 1 -5 3a12 12 0 0 1 -5 -3a12 12 0 0 0 8.5 -3" />
          <path d="M11 11l1 1l2 -2" />
        </svg>
      ),
    },
    {
      id: 'keputusan-lebih-baik',
      number: '03',
      title: 'Keputusan Lebih Baik',
      shortDesc: 'Berdasarkan data histori & insight AI yang akurat.',
      fullDesc: 'Ambil langkah finansial yang bijak berdasarkan analisa kebiasaan belanja dan proyeksi rasio kecukupan tabungan dari asisten kecerdasan buatan.',
      highlightVal: '3.5x',
      highlightLabel: 'Keputusan Lebih Terarah',
      metricIcon: '📈',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 17l6 -6l4 4l8 -8" />
          <path d="M14 7l7 0l0 7" />
        </svg>
      ),
    },
    {
      id: 'raih-tujuan-finansial',
      number: '04',
      title: 'Raih Tujuan Finansial',
      shortDesc: 'Wujudkan tabungan, investasi, dan mimpi masa depan.',
      fullDesc: 'Capai target impian seperti liburan, pembelian kendaraan, hingga dana darurat dengan tracker progress tabungan interaktif yang konsisten.',
      highlightVal: '2x Lipat',
      highlightLabel: 'Target Finansial Lebih Cepat',
      metricIcon: '🎯',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
          <path d="M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" />
          <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        </svg>
      ),
    },
  ];

  const current = benefits[activeTab];

  return (
    <section id="manfaat" className="relative py-16 lg:py-24 overflow-hidden select-none transition-colors duration-300">
      
      <div className="absolute top-1/2 left-[-5%] -translate-y-1/2 w-[600px] h-[600px] bg-radial from-[#10B981]/25 via-[#0F766E]/15 to-transparent rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[600px] h-[600px] bg-radial from-[#34D399]/20 via-[#0F766E]/20 to-transparent rounded-full blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6 text-left">
            
            <div className="space-y-4">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10B981]/15 dark:bg-[#10B981]/20 border border-[#10B981]/30 text-[#0F766E] dark:text-[#10B981] text-xs font-bold tracking-wide backdrop-blur-md shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                  Manfaat untuk Kamu
                </div>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight leading-[1.3] text-slate-900 dark:text-white">
                Lebih dari Sekadar Mencatat, <br />
                Ini tentang <span className="bg-gradient-to-r from-[#0F766E] via-[#10B981] to-[#34D399] bg-clip-text text-transparent">Masa Depan Finansialmu</span>
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
                        ? 'bg-[#0F766E]/15 dark:bg-[#0F766E]/30 border-[#10B981] shadow-lg shadow-[#10B981]/15 translate-x-1.5'
                        : 'bg-[#10B981]/5 dark:bg-[#042421]/30 border-white/40 dark:border-[#10B981]/15 hover:border-[#10B981]/40 hover:bg-[#10B981]/10'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/30'
                        : 'bg-[#10B981]/15 text-[#0F766E] dark:text-[#10B981]'
                    }`}>
                      {item.icon}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h3>
                        <span className={`text-xs font-extrabold ${isActive ? 'text-[#10B981]' : 'text-slate-400 dark:text-slate-500'}`}>
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
            <div className="w-full bg-[#0F766E]/10 dark:bg-[#042421]/40 backdrop-blur-3xl border border-white/50 dark:border-[#10B981]/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#10B981]/10 flex flex-col justify-between text-left transition-all duration-500 relative overflow-hidden">
              
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-gradient-to-br from-white/30 dark:from-[#10B981]/20 to-transparent rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
                    <span className="text-xs font-bold text-slate-800 dark:text-emerald-100">
                      Fokus Manfaat {current.number}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/15 px-3 py-1 rounded-full border border-[#10B981]/20">
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

                <div className="p-4 rounded-2xl bg-[#10B981]/10 dark:bg-[#052E2B]/50 backdrop-blur-xl border border-white/40 dark:border-[#10B981]/20 flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0F766E] to-[#10B981] text-white flex items-center justify-center text-2xl shadow-md shrink-0">
                    {current.metricIcon}
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                      {current.highlightVal}
                    </p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-emerald-200/80">
                      {current.highlightLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 p-4 rounded-2xl bg-[#10B981]/10 dark:bg-[#052E2B]/50 backdrop-blur-xl border border-white/40 dark:border-[#10B981]/20 space-y-3 relative z-10">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>Proyeksi Dampak Keuangan</span>
                  <span className="text-[#10B981]">Terverifikasi AI</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
                    <span>Efisiensi Pengelolaan</span>
                    <span className="font-bold text-[#10B981]">+38%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900/10 dark:bg-slate-700/60 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#0F766E] to-[#10B981] rounded-full w-[82%] transition-all duration-700" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
                    <span>Konsistensi Tabungan</span>
                    <span className="font-bold text-[#10B981]">94%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900/10 dark:bg-slate-700/60 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#10B981] to-[#34D399] rounded-full w-[94%] transition-all duration-700" />
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}