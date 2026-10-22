import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Bot, Banknote, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CtaSection() {
  const navigate = useNavigate();

  return (
    <section className="relative py-12 lg:py-20 overflow-hidden select-none transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="relative bg-slate-100/90 dark:bg-[#141417] backdrop-blur-3xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[40px] p-8 sm:p-12 lg:p-16 shadow-2xl shadow-black/15 overflow-hidden text-left transition-all duration-300">
          
          <div className="absolute top-1/2 right-10 -translate-y-1/2 w-[500px] h-[500px] bg-[#10B981]/20 dark:bg-[#10B981]/25 rounded-full blur-[120px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative z-10">
            
            <div className="lg:col-span-6 space-y-6">
              
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10B981]/15 dark:bg-[#10B981]/20 border border-[#10B981]/30 text-[#0F766E] dark:text-[#10B981] text-xs font-bold tracking-wide backdrop-blur-md shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                  Mulai Bersama Rezekify
                </div>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15]">
                Siap Mengelola Keuanganmu <br />
                Bersama <span className="text-emerald-500 dark:text-emerald-400">Rezekify?</span>
              </h2>

              <p className="text-sm sm:text-base text-slate-600 dark:text-emerald-100/80 max-w-xl font-normal leading-relaxed">
                Jangan tunda lagi! Mulai perjalanan finansial yang lebih baik, terencana, dan tercatat otomatis berkat asisten pintar Rezekify sekarang juga.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/register')}
                  className="px-8 py-4 rounded-full text-sm font-bold text-white bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:from-[#0F766E]/90 hover:to-[#10B981]/90 shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center gap-2"
                >
                  Mulai Sekarang <ArrowRight className="w-4 h-4 ml-2 inline" />
                </motion.button>

                <motion.a
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  href="#fitur"
                  className="px-8 py-4 rounded-full text-sm font-bold text-slate-700 dark:text-white bg-white/70 dark:bg-white/10 border border-[#10B981]/30 dark:border-white/20 hover:bg-white dark:hover:bg-white/20 backdrop-blur-md transition-all shadow-sm"
                >
                  Lihat Fitur
                </motion.a>
              </div>
            </div>

            <div className="lg:col-span-6 flex justify-center lg:justify-end relative">
              
              <div className="absolute -top-6 left-2 sm:left-6 z-30 bg-white/95 dark:bg-[#141417] backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 p-3.5 rounded-2xl shadow-xl max-w-[210px]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-[11px] font-bold text-slate-800 dark:text-white leading-tight">
                    Input via Chat AI instan & otomatis tercatat!
                  </p>
                </div>
              </div>

              <div className="w-full max-w-[340px] sm:max-w-[380px] bg-white/80 dark:bg-white/10 backdrop-blur-2xl border-2 border-emerald-500/40 dark:border-emerald-500/40 rounded-[36px] p-5 shadow-2xl shadow-emerald-500/10 space-y-4 transform hover:scale-[1.02] transition-transform duration-500">

                <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-200/80 dark:border-white/15">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-xs text-white font-bold">
                      <Bot className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Rezekify AI Assistant</p>
                      <p className="text-[9px] text-teal-700 dark:text-emerald-300 font-semibold">Online • Auto-Category</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-teal-700 dark:text-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    Live Chat
                  </span>
                </div>

                <div className="space-y-3 pt-1 text-left">

                  <div className="flex justify-end">
                    <div className="bg-emerald-500 text-white p-3 rounded-2xl rounded-tr-none max-w-[85%] shadow-md">
                      <p className="text-xs font-semibold">
                        "Catat pemasukan gajian bulan ini Rp 7.500.000 masuk ke BCA" <Banknote className="w-4 h-4 text-emerald-400 inline ml-1" />
                      </p>
                      <span className="text-[9px] font-medium text-emerald-100 block text-right mt-1">10:42 AM</span>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="bg-white/90 dark:bg-white/20 backdrop-blur-md border border-emerald-500/30 dark:border-white/20 text-slate-800 dark:text-white p-3.5 rounded-2xl rounded-tl-none max-w-[90%] space-y-2 shadow-md">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Pemasukan Berhasil Dicatat!</span>
                      </div>

                      <div className="bg-slate-100 dark:bg-slate-900/40 p-2.5 rounded-xl text-[11px] space-y-1 font-mono border border-slate-200 dark:border-white/10">
                        <p className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-300">Nominal:</span>
                          <strong className="text-teal-700 dark:text-emerald-300">Rp 7.500.000</strong>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-300">Kategori:</span>
                          <strong className="text-slate-800 dark:text-white">Gaji / Incomes</strong>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-300">Akun:</span>
                          <strong className="text-slate-800 dark:text-white">Bank BCA</strong>
                        </p>
                      </div>

                      <p className="text-[10px] text-teal-700 dark:text-emerald-200/90 italic font-medium">
                        "Saldo BCA diperbarui. Proyeksi tabungan bulan ini naik +25%!"
                      </p>
                    </div>
                  </div>

                </div>

                <div className="pt-2">
                  <div className="bg-white/90 dark:bg-white/10 backdrop-blur-md border border-emerald-500/30 dark:border-white/20 rounded-full px-4 py-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 shadow-inner">
                    <span className="text-[11px] opacity-70">Tulis transaksi atau kirim foto...</span>
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
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