export default function AboutSection() {
  const capabilities = [
    {
      title: 'Catat Transaksi Manual & Scan Struk',
      description: 'Pencatatan serba otomatis menggunakan teknologi OCR AI modern.',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4 7v-1a2 2 0 0 1 2 -2h2" />
          <path d="M4 17v1a2 2 0 0 0 2 2h2" />
          <path d="M16 4h2a2 2 0 0 1 2 2v1" />
          <path d="M16 20h2a2 2 0 0 0 2 -2v-1" />
          <path d="M5 12l14 0" />
        </svg>
      ),
    },
    {
      title: 'Kelola Anggaran & Pengeluaran',
      description: 'Atur pos keuangan bulanan agar selalu sesuai rencana.',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a1 1 0 0 0 1 -1v-3" />
          <path d="M20 12h-7a1 1 0 0 0 -1 1v2a1 1 0 0 0 1 1h7a1 1 0 0 0 1 -1v-2a1 1 0 0 0 -1 -1z" />
        </svg>
      ),
    },
    {
      title: 'Pantau Tabungan & Target Finansial',
      description: 'Capai impian finansial dengan tracker tabungan interaktif.',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
          <path d="M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" />
          <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        </svg>
      ),
    },
    {
      title: 'Analisis Pola Keuangan Berbasis AI',
      description: 'Identifikasi kebiasaan belanja impulsif dengan bantuan mesin cerdas.',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1-.7l-.7 .7m11.4 11.4l.7 .7m-12.1-.7l-.7 .7" />
          <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
        </svg>
      ),
    },
    {
      title: 'Prediksi Kondisi Keuangan',
      description: 'Dapatkan proyeksi arus kas masa depan berdasarkan tren histori pengeluaran.',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 17l6 -6l4 4l8 -8" />
          <path d="M14 7l7 0l0 7" />
        </svg>
      ),
    },
    {
      title: 'Laporan & Insight Mudah Dipahami',
      description: 'Grafik informatif yang bersih tanpa istilah finansial yang rumit.',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M8 5v14l11 -7z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="tentang" className="relative py-16 lg:py-24 overflow-hidden select-none transition-colors duration-300">
      
      <div className="absolute top-1/2 left-[-5%] -translate-y-1/2 w-[600px] h-[600px] bg-radial from-[#10B981]/20 via-[#0F766E]/10 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[600px] h-[600px] bg-radial from-[#34D399]/15 via-[#0F766E]/15 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          <div className="lg:col-span-5 space-y-7 text-left">
            
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10B981]/15 dark:bg-[#10B981]/20 border border-[#10B981]/30 text-[#0F766E] dark:text-[#10B981] text-xs font-bold tracking-wide backdrop-blur-md shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                Kenapa Rezekify?
              </div>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-[1.35] text-slate-900 dark:text-white pb-1">
              Semua yang Kamu <br />
              Butuhkan dalam <br />
              <span className="text-emerald-500 dark:text-emerald-400">Satu Platform</span>
            </h2>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-lg">
              Rezekify mengintegrasikan teknologi AI dengan sistem manajemen keuangan yang intuitif, sehingga kamu bisa lebih fokus pada tujuan finansialmu.
            </p>

            <div className="pt-2 grid grid-cols-2 gap-3 sm:gap-4 max-w-lg">

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/50 dark:bg-[#141417] backdrop-blur-xl border border-white/80 dark:border-zinc-800/80 shadow-md shadow-black/5 flex items-center gap-3 group hover:border-zinc-700/60 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F766E] to-[#10B981] text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                  ⚡
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">100%</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-tight">Otomatis & Terintegrasi</p>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/50 dark:bg-[#141417] backdrop-blur-xl border border-white/80 dark:border-zinc-800/80 shadow-md shadow-black/5 flex items-center gap-3 group hover:border-zinc-700/60 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981] to-[#34D399] text-slate-900 flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                  🤖
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">24/7</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-tight">Monitoring AI Realtime</p>
                </div>
              </div>

            </div>

          </div>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {capabilities.map((item, idx) => (
                <div
                  key={idx}
                  className="group relative bg-white/50 dark:bg-[#141417] backdrop-blur-2xl border border-white/80 dark:border-zinc-800/80 p-6 rounded-3xl shadow-lg shadow-black/5 hover:shadow-2xl hover:shadow-black/20 hover:border-zinc-700/60 hover:-translate-y-1.5 transition-all duration-300 text-left flex flex-col justify-between overflow-hidden"
                >
                  <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#10B981]/15 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

                  <div className="space-y-4 relative z-10">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#10B981]/20 to-[#0F766E]/10 dark:from-[#10B981]/30 dark:to-[#34D399]/10 text-[#0F766E] dark:text-[#10B981] border border-[#10B981]/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-gradient-to-r group-hover:from-[#0F766E] group-hover:to-[#10B981] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[#10B981]/30">
                      {item.icon}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#0F766E] dark:group-hover:text-[#10B981] transition-colors leading-snug">
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