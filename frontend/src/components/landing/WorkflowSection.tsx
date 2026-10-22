import { useState } from 'react';
import { ArrowRight, Laptop } from 'lucide-react';

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      number: '1',
      title: 'Daftar Akun',
      shortDesc: 'Buat akun dalam hitungan menit',
      fullDetail: 'Proses pendaftaran cepat dengan verifikasi email yang aman dan tanpa biaya tersembunyi.',
      badge: 'Cepat & Gratis',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
          <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
        </svg>
      ),
    },
    {
      number: '2',
      title: 'Hubungkan Akun',
      shortDesc: 'Tambah rekening, e-wallet, atau kas',
      fullDetail: 'Hubungkan berbagai dompet digital, rekening bank, hingga kas tunai secara aman dalam satu tempat.',
      badge: 'Multi-Bank',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" />
          <path d="M3 10h18" />
          <path d="M7 15h.01" />
        </svg>
      ),
    },
    {
      number: '3',
      title: 'Catat Transaksi',
      shortDesc: 'Input manual atau scan struk AI',
      fullDetail: 'Foto struk belanjaanmu dan biarkan teknologi AI OCR mengekstrak rincian pengeluaran secara instan.',
      badge: 'AI OCR',
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
      number: '4',
      title: 'Atur Anggaran',
      shortDesc: 'Set budget & kategori pos keuangan',
      fullDetail: 'Kelola batas pengeluaran bulanan per kategori dan dapatkan peringatan otomatis sebelum melebihi limit.',
      badge: 'Realtime Alert',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a1 1 0 0 0 1 -1v-3" />
          <path d="M20 12h-7a1 1 0 0 0 -1 1v2a1 1 0 0 0 1 1h7a1 1 0 0 0 1 -1v-2a1 1 0 0 0 -1 -1z" />
        </svg>
      ),
    },
    {
      number: '5',
      title: 'Pantau & Analisis',
      shortDesc: 'Lihat laporan & insight finansial',
      fullDetail: 'Dapatkan grafik tren cashflow yang bersih serta rekomendasi AI untuk mencapai impian finansialmu.',
      badge: 'AI Insight',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M3 17l6 -6l4 4l8 -8" />
          <path d="M14 7l7 0l0 7" />
        </svg>
      ),
    },
  ];

  const current = steps[activeStep];

  return (
    <section id="cara-penggunaan" className="relative py-16 lg:py-24 overflow-hidden select-none transition-colors duration-300">
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-radial from-[#10B981]/15 via-[#0F766E]/10 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10B981]/15 dark:bg-[#10B981]/20 border border-[#10B981]/30 text-[#0F766E] dark:text-[#10B981] text-xs font-bold tracking-wide backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
              Cara Penggunaan Rezekify
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-[1.3] text-slate-900 dark:text-white">
            Mudah Digunakan, <br />
            Hanya dalam <span className="text-emerald-500 dark:text-emerald-400">5 Langkah Sederhana</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-xl mx-auto">
            Mulai kelola keuanganmu sekarang juga dengan alur praktis yang dirancang khusus untuk kenyamanan penggunaan harianmu.
          </p>

        </div>

        <div className="relative mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
            {steps.map((item, idx) => {
              const isActive = activeStep === idx;
              return (
                <div
                  key={item.number}
                  onClick={() => setActiveStep(idx)}
                  className={`group cursor-pointer p-5 rounded-3xl backdrop-blur-2xl border transition-all duration-300 text-left flex flex-col justify-between relative ${
                    isActive
                      ? 'bg-white/90 dark:bg-[#141417] border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                      : 'bg-white/50 dark:bg-[#141417]/50 border-white/80 dark:border-zinc-800/80 hover:border-zinc-700/60 hover:bg-white/70 dark:hover:bg-[#141417]/70'
                  }`}
                >
                  <div className="space-y-4">
                    
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all ${
                        isActive
                          ? 'bg-gradient-to-br from-[#0F766E] to-[#10B981] text-white shadow-md shadow-[#10B981]/30 scale-110'
                          : 'bg-[#10B981]/15 text-[#0F766E] dark:text-[#10B981]'
                      }`}>
                        {item.number}
                      </div>

                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all ${
                        isActive ? 'text-[#10B981]' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {item.icon}
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed font-normal">
                      {item.shortDesc}
                    </p>
                  </div>

                  {idx < steps.length - 1 && (
                    <div className="hidden lg:flex items-center justify-center absolute -right-3.5 top-[40px] -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-slate-50 dark:bg-[#141417] border border-slate-200/80 dark:border-zinc-800 text-emerald-500 shadow-sm pointer-events-none">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white/60 dark:bg-[#141417] backdrop-blur-2xl border border-white/80 dark:border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl transition-all duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">

            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#10B981] text-white font-extrabold flex items-center justify-center text-xs shadow-md">
                  {current.number}
                </span>
                <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/15 px-3 py-1 rounded-full">
                  Langkah {current.number} dari 5
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {current.title}
              </h3>

              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-xl">
                {current.fullDetail}
              </p>
            </div>

            <div className="lg:col-span-5 bg-white/70 dark:bg-zinc-900/80 rounded-2xl p-5 border border-white/60 dark:border-zinc-800/80 shadow-inner flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-[#10B981]">Status Alur Kerja</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">Kelola Keuangan Kapan Saja</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Akses fleksibel dari Web & Mobile</p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center text-xl shadow-lg shrink-0 animate-pulse">
                <Laptop className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}