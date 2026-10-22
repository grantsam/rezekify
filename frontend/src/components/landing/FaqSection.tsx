import { useState } from 'react';

export default function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      question: 'Apakah Rezekify gratis digunakan?',
      answer: 'Ya, Rezekify menyediakan layanan dasar secara gratis untuk pencatatan transaksi bulanan, pemantauan dompet, dan analisis kecerdasan buatan.',
    },
    {
      question: 'Bagaimana cara menghubungkan akun bank atau e-wallet?',
      answer: 'Kamu dapat menambahkan akun bank dan e-wallet dengan mudah melalui menu "Hubungkan Akun". Semua data terenkripsi aman.',
    },
    {
      question: 'Apakah data keuangan saya aman di Rezekify?',
      answer: 'Keamanan data adalah prioritas utama kami. Rezekify menggunakan enkripsi end-to-end standar industri perbankan.',
    },
    {
      question: 'Apakah bisa digunakan di semua perangkat?',
      answer: 'Tentu saja! Rezekify berbasis web responsif yang dapat diakses secara lancar melalui HP, tablet, maupun laptop.',
    },
    {
      question: 'Bagaimana jika saya mengalami kendala teknis?',
      answer: 'Tim bantuan Rezekify siap melayani kamu 24/7 melalui fitur live chat support dan bantuan WhatsApp.',
    },
  ];

  return (
    <section id="faq" className="relative py-16 lg:py-24 overflow-hidden select-none transition-colors duration-300">
      
      <div className="absolute top-1/2 left-[-5%] -translate-y-1/2 w-[600px] h-[600px] bg-radial from-[#10B981]/15 via-[#0F766E]/10 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          <div className="lg:col-span-5 space-y-6">
            
            <div className="text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10B981]/15 dark:bg-[#10B981]/20 border border-[#10B981]/30 text-[#0F766E] dark:text-[#10B981] text-xs font-bold tracking-wide backdrop-blur-md shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                Pertanyaan Populer
              </div>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.3] text-slate-900 dark:text-white text-left">
              Pertanyaan yang <br />
              <span className="text-emerald-500 dark:text-emerald-400">Sering Diajukan</span>
            </h2>

            <div className="bg-[#0F766E]/10 dark:bg-[#141417] backdrop-blur-3xl border border-white/50 dark:border-zinc-800/80 rounded-3xl p-6 shadow-xl space-y-5 text-center relative overflow-hidden">

              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#0F766E] to-[#10B981] text-white flex items-center justify-center text-3xl shadow-lg">
                💬
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Masih Ada Pertanyaan?</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">Tim kami siap membantu kebutuhan keuanganmu 24/7.</p>
              </div>

              <button className="w-full py-3 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#0F766E] to-[#10B981] shadow-lg hover:shadow-xl hover:shadow-[#10B981]/30 transition-all flex items-center justify-center gap-2">
                Hubungi Kami ➔
              </button>
            </div>

          </div>

          <div className="lg:col-span-7 space-y-3 pt-2">
            {faqs.map((faq, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl backdrop-blur-2xl border transition-all duration-300 overflow-hidden text-left ${
                    isOpen
                      ? 'bg-[#0F766E]/15 dark:bg-[#0F766E]/30 border-[#10B981] shadow-md shadow-[#10B981]/10'
                      : 'bg-white/40 dark:bg-[#141417]/50 border-white/40 dark:border-zinc-800/80 hover:border-zinc-700/60'
                  }`}
                >
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 dark:text-white"
                  >
                    <span>{faq.question}</span>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform ${
                      isOpen ? 'bg-[#10B981] text-white rotate-45' : 'bg-[#10B981]/15 text-[#0F766E] dark:text-[#10B981]'
                    }`}>
                      +
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-900/5 dark:border-white/5 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
}