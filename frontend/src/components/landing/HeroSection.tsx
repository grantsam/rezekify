import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  UtensilsCrossed,
  Fuel,
  ShoppingBag,
  RotateCcw,
} from 'lucide-react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { formatRupiah } from '../../utils/formatters';

const BASELINE_LIQUID = 810000;
const DAYS_REMAINING = 18;
const baselineRunway = Math.floor(BASELINE_LIQUID / DAYS_REMAINING); // 45000

const CHART_BARS = [
  { targetHeight: '40%', bg: 'bg-emerald-500/20' },
  { targetHeight: '70%', bg: 'bg-emerald-500/40' },
  { targetHeight: '95%', bg: 'bg-emerald-500' },
  { targetHeight: '50%', bg: 'bg-emerald-500/30' },
  { targetHeight: '85%', bg: 'bg-teal-600' },
];

export default function HeroSection() {
  const navigate = useNavigate();
  const [simulatedExpense, setSimulatedExpense] = useState(0);

  const simulatedRunway =
    simulatedExpense === 0
      ? baselineRunway
      : Math.max(0, Math.floor((BASELINE_LIQUID - simulatedExpense) / DAYS_REMAINING));

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 20 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], ['3deg', '-3deg']), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], ['-3deg', '3deg']), springConfig);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section
     id="beranda"
     className="relative pt-32 sm:pt-36 lg:pt-40 pb-16 lg:pb-24 overflow-hidden select-none"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-radial from-emerald-500/20 via-teal-600/10 to-transparent rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-[5%] w-[500px] h-[500px] bg-gradient-to-br from-emerald-500/20 to-emerald-400/10 rounded-full blur-[110px] pointer-events-none -z-10 animate-pulse duration-[6000ms]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center">

          <div className="lg:col-span-6 space-y-6 text-left pr-0 lg:pr-4">

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 text-teal-700 dark:text-emerald-400 text-xs font-semibold tracking-wide backdrop-blur-md shadow-sm">
              <svg
                className="w-4 h-4 text-emerald-400 animate-spin duration-[4000ms]"
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
                className="px-8 py-3.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-500 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center gap-2 group"
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
                className="px-8 py-3.5 rounded-full text-sm font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-emerald-500 dark:hover:border-emerald-400 backdrop-blur-md transition-all duration-300"
              >
                Pelajari Lebih Lanjut
              </a>
            </div>

            <div className="pt-6 flex flex-wrap items-center gap-6 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 border-t border-slate-200/50 dark:border-white/10">
              <div className="flex items-center gap-2 group cursor-default">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-teal-700 dark:text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-110">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -3.5 9a12 12 0 0 1 -5 3a12 12 0 0 1 -5 -3a12 12 0 0 1 -3.5 -9a12 12 0 0 0 8.5 -3" />
                    <path d="M11 11l1 1l2 -2" />
                  </svg>
                </div>
                <span>Aman & Terpercaya</span>
              </div>

              <div className="flex items-center gap-2 group cursor-default">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-teal-700 dark:text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-110">
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
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-teal-700 dark:text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-110">
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

          <div className="lg:col-span-6 relative flex justify-center lg:justify-end items-center py-6 lg:py-0 px-4 sm:px-6 [perspective:1000px]">

            <motion.div
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
              className="relative w-full max-w-md lg:max-w-lg space-y-4 my-4"
            >

              <div className="absolute -top-8 left-0 text-amber-400 animate-pulse duration-[1000ms] pointer-events-none z-30">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute -top-8 right-2 text-emerald-400 animate-pulse duration-[1800ms] pointer-events-none z-30">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute top-1/2 -right-3 text-teal-400 animate-pulse duration-[1400ms] pointer-events-none z-30">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute -bottom-6 left-2 text-emerald-400/40 pointer-events-none z-30">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute -bottom-6 right-0 text-teal-400/30 pointer-events-none z-30">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              </div>

              <div className="absolute -top-6 left-2 sm:left-6 z-20 bg-white/90 dark:bg-[#141417] backdrop-blur-xl border border-white/60 dark:border-zinc-800/80 p-3.5 rounded-2xl shadow-xl shadow-black/10 transition-transform hover:scale-105">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">Total Saldo Terkelola</p>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                      Rp 5.250.000
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Telemetry Card with Animated Perimeter Border Beam */}
              <div className="relative rounded-3xl p-[1px] overflow-hidden shadow-2xl transition-all duration-500">
                {/* Subtle glowing perimeter border beam */}
                <motion.div
                  className="absolute -inset-[100%] bg-[conic-gradient(from_0deg,transparent_0_300deg,#10b981_340deg,transparent_360deg)] opacity-60 dark:opacity-80 pointer-events-none"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                />

                <div className="relative w-full bg-white/90 dark:bg-[#141417]/95 backdrop-blur-xl rounded-[23px] p-6 border border-white/60 dark:border-zinc-800/80">
                  <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-zinc-800/80 pb-3.5 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Live AI Telemetry</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/15 text-teal-700 dark:text-emerald-400 font-bold px-2.5 py-0.5 rounded-full">
                      Realtime
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Pemasukan */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-[11px] text-slate-600 dark:text-emerald-200">Pemasukan (Payable)</p>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">Rp 3.800.000</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+12%</span>
                    </div>

                    {/* Pengeluaran Rutin */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center text-xs font-bold">
                          <ArrowDownRight className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-[11px] text-slate-600 dark:text-rose-200">Pengeluaran Rutin</p>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">Rp 2.950.000</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-rose-500">-5%</span>
                    </div>
                  </div>

                  {/* Interactive Runway Sandbox */}
                  <div className="mt-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/70 dark:border-zinc-800/70 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          Simulasi Runway Harian
                        </p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span
                            data-testid="hero-sim-runway"
                            className="font-mono text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums"
                          >
                            {formatRupiah(simulatedRunway)}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-sans">/hari</span>
                        </div>
                      </div>
                      {simulatedExpense > 0 && (
                        <button
                          type="button"
                          data-testid="hero-sim-reset"
                          onClick={() => setSimulatedExpense(0)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-200/70 dark:bg-zinc-800 hover:bg-slate-300/70 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>

                    <div
                      data-testid="hero-sim-chips"
                      className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/50 dark:border-zinc-800/60"
                    >
                      <button
                        type="button"
                        onClick={() => setSimulatedExpense((prev) => prev + 25000)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 transition-all active:scale-95 cursor-pointer"
                      >
                        <UtensilsCrossed className="w-3 h-3" />
                        <span>+25rb Makan Siang</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimulatedExpense((prev) => prev + 30000)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/20 hover:border-teal-500/40 transition-all active:scale-95 cursor-pointer"
                      >
                        <Fuel className="w-3 h-3" />
                        <span>+30rb Bensin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimulatedExpense((prev) => prev + 50000)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 transition-all active:scale-95 cursor-pointer"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>+50rb Belanja</span>
                      </button>
                    </div>
                  </div>

                  {/* 5 Rising Chart Bars */}
                  <div className="mt-4 pt-3.5 border-t border-slate-200/50 dark:border-zinc-800/80 flex items-end justify-between gap-2.5 h-16 px-2">
                    {CHART_BARS.map((bar, idx) => (
                      <motion.div
                        key={idx}
                        className={`w-full rounded-t-md ${bar.bg}`}
                        initial={{ height: '0%' }}
                        whileInView={{ height: bar.targetHeight }}
                        transition={{ duration: 0.6, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                        viewport={{ once: true }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-5 right-0 z-20 bg-white/90 dark:bg-[#141417] backdrop-blur-xl border border-white/60 dark:border-zinc-800/80 p-3 rounded-2xl shadow-xl flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-semibold text-emerald-400">Rekomendasi AI</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Tabungan Kuartal Ini Aman</p>
                </div>
              </div>

            </motion.div>

          </div>

        </div>
      </div>
    </section>
  );
}