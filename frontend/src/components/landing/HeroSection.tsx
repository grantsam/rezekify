import { useNavigate } from 'react-router-dom';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section
     id="beranda" 
     className="relative pt-32 sm:pt-36 lg:pt-40 pb-16 lg:pb-24 overflow-hidden select-none"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-radial from-[#10B981]/20 via-[#0F766E]/10 to-transparent rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-[5%] w-[500px] h-[500px] bg-gradient-to-br from-[#10B981]/20 to-[#34D399]/10 rounded-full blur-[110px] pointer-events-none -z-10 animate-pulse duration-[6000ms]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center">
          
          <div className="lg:col-span-6 space-y-6 text-left pr-0 lg:pr-4">
            
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10B981]/15 dark:bg-[#10B981]/20 border border-[#10B981]/30 text-[#0F766E] dark:text-[#10B981] text-xs font-semibold tracking-wide backdrop-blur-md shadow-sm">
              <svg
                className="w-4 h-4 text-[#10B981] animate-spin duration-[4000ms]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M12 3a9 9 0 1 0 9 9" />
              </svg>
              AI-Powered Personal Finance
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] xl:text-[60px] font-extrabold tracking-tight leading-[1.12] text-slate-900 dark:text-white">
              Kelola Keuangan <br />
              Lebih Mudah, <br />
              Raih Masa Depan <br />
              <span className="text-emerald-500 dark:text-emerald-400">Lebih Baik</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed font-normal">
              Rezekify adalah platform asisten keuangan personal berbasis web dan AI yang membantu kamu mencatat, mengelola, memantau, memahami, dan mengevaluasi kondisi keuangan dengan lebih mudah.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-3.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-[#0F766E] to-[#10B981] shadow-lg shadow-[#10B981]/25 hover:shadow-xl hover:shadow-[#10B981]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center gap-2 group"
              >
                Mulai Sekarang
                <svg
                  className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 12l14 0" />
                  <path d="M13 18l6 -6" />
                  <path d="M13 6l6 6" />
                </svg>
              </button>

              <a
                href="#fitur"
                className="px-8 py-3.5 rounded-full text-sm font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-[#10B981] dark:hover:border-[#10B981] backdrop-blur-md transition-all duration-300"
              >
                Pelajari Lebih Lanjut
              </a>
            </div>

            <div className="pt-6 flex flex-wrap items-center gap-6 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 border-t border-slate-200/50 dark:border-white/10">
              <div className="flex items-center gap-2 group cursor-default">
                <div className="w-5 h-5 rounded-full bg-[#10B981]/20 text-[#0F766E] dark:text-[#10B981] flex items-center justify-center transition-transform group-hover:scale-110">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -3.5 9a12 12 0 0 1 -5 3a12 12 0 0 1 -5 -3a12 12 0 0 1 -3.5 -9a12 12 0 0 0 8.5 -3" />
                    <path d="M11 11l1 1l2 -2" />
                  </svg>
                </div>
                <span>Aman & Terpercaya</span>
              </div>

              <div className="flex items-center gap-2 group cursor-default">
                <div className="w-5 h-5 rounded-full bg-[#10B981]/20 text-[#0F766E] dark:text-[#10B981] flex items-center justify-center transition-transform group-hover:scale-110">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M5 5m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z" />
                    <path d="M9 9h6v6h-6z" />
                    <path d="M3 10h2" />
                    <path d="M14 3v2" />
                    <path d="M21 10h-2" />
                  </svg>
                </div>
                <span>Berbasis AI</span>
              </div>

              <div className="flex items-center gap-2 group cursor-default">
                <div className="w-5 h-5 rounded-full bg-[#10B981]/20 text-[#0F766E] dark:text-[#10B981] flex items-center justify-center transition-transform group-hover:scale-110">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M6 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-14z" />
                    <path d="M11 4h2" />
                    <path d="M12 17v.01" />
                  </svg>
                </div>
                <span>Akses Fleksibel</span>
              </div>
            </div>

          </div>

          <div className="lg:col-span-6 relative flex justify-center lg:justify-end items-center py-6 lg:py-0 px-4 sm:px-6">
            
            <div className="relative w-full max-w-md lg:max-w-lg space-y-4 my-4">
              
              <div className="absolute -top-8 left-0 text-amber-400 animate-pulse duration-[1000ms] pointer-events-none z-30">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute -top-8 right-2 text-[#10B981] animate-pulse duration-[1800ms] pointer-events-none z-30">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute top-1/2 -right-3 text-teal-400 animate-pulse duration-[1400ms] pointer-events-none z-30">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute -bottom-6 left-2 text-emerald-400 animate-pulse duration-[2200ms] pointer-events-none z-30">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute -bottom-6 right-0 text-cyan-300 animate-pulse duration-[1600ms] pointer-events-none z-30">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute -top-6 left-2 sm:left-6 z-20 bg-white/90 dark:bg-[#141417] backdrop-blur-xl border border-white/60 dark:border-zinc-800/80 p-3.5 rounded-2xl shadow-xl shadow-black/10 transition-transform hover:scale-105">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-[#10B981] flex items-center justify-center font-bold">
                    💰
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">Total Saldo Terkelola</p>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                      Rp 5.250.000
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full bg-white/80 dark:bg-[#141417] backdrop-blur-xl border border-white/60 dark:border-zinc-800/80 rounded-3xl p-6 shadow-2xl transition-all duration-500 hover:border-zinc-700/60">
                <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-zinc-800/80 pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Live AI Telemetry</span>
                  </div>
                  <span className="text-[10px] bg-[#10B981]/15 text-[#0F766E] dark:text-[#10B981] font-bold px-2.5 py-0.5 rounded-full">
                    Realtime
                  </span>
                </div>

                <div className="space-y-3.5">
                  {/* Pemasukan */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                        ↑
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] text-slate-600 dark:text-emerald-200">Pemasukan (Payable)</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">Rp 3.800.000</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+12%</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center text-xs font-bold">
                        ↓
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] text-slate-600 dark:text-rose-200">Pengeluaran Rutin</p>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">Rp 2.950.000</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-rose-500">-5%</span>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-200/50 dark:border-zinc-800/80 flex items-end justify-between gap-2.5 h-16 px-2">
                  <div className="w-full bg-[#10B981]/20 rounded-t-md h-[40%] hover:h-[65%] transition-all" />
                  <div className="w-full bg-[#10B981]/40 rounded-t-md h-[70%] hover:h-[85%] transition-all" />
                  <div className="w-full bg-[#10B981] rounded-t-md h-[95%] hover:h-[100%] transition-all" />
                  <div className="w-full bg-[#10B981]/30 rounded-t-md h-[50%] hover:h-[70%] transition-all" />
                  <div className="w-full bg-[#0F766E] rounded-t-md h-[85%] hover:h-[95%] transition-all" />
                </div>
              </div>

              <div className="absolute -bottom-5 right-0 z-20 bg-white/90 dark:bg-[#141417] backdrop-blur-xl border border-white/60 dark:border-zinc-800/80 p-3 rounded-2xl shadow-xl flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#0F766E] to-[#10B981] text-white flex items-center justify-center text-xs font-bold">
                  ✨
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-semibold text-[#10B981]">Rekomendasi AI</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Tabungan Kuartal Ini Aman</p>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
}