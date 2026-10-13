import { useState } from 'react';
// @ts-ignore
import rezekifyLogo from '../../assets/icon_text_rezekify.png';
// @ts-ignore
import vigrisLabsLogo from '../../assets/icon_text_vigrislabs.png';

export default function FooterSection() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 4000);
    }
  };

  const navLinks = [
    { name: 'Beranda', href: '#beranda' },
    { name: 'Tentang', href: '#tentang' },
    { name: 'Fitur', href: '#fitur' },
    { name: 'Manfaat', href: '#manfaat' },
    { name: 'Cara Penggunaan', href: '#cara-penggunaan' },
    { name: 'FAQ', href: '#faq' },
  ];

  const socialLinks = [
    {
      name: 'Instagram',
      href: 'https://instagram.com',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      ),
    },
    {
      name: 'LinkedIn',
      href: 'https://linkedin.com',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      ),
    },
    {
      name: 'GitHub',
      href: 'https://github.com',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      ),
    },
    {
      name: 'X (Twitter)',
      href: 'https://x.com',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
          <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
        </svg>
      ),
    },
    {
      name: 'YouTube',
      href: 'https://youtube.com',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="relative pt-16 pb-12 overflow-hidden select-none bg-[#E6F7EF]/60 dark:bg-[#021D17] border-t border-[#10B981]/20 transition-colors duration-300 text-left">
      
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-radial from-[#10B981]/15 via-[#0F766E]/10 to-transparent rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-6 pb-12 border-b border-slate-900/10 dark:border-white/10">
          
          <div className="w-full lg:w-[28%] space-y-4">
            <div className="flex items-center">
              <img
                src={rezekifyLogo}
                alt="Rezekify Logo"
                className="h-11 sm:h-12 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              Platform manajemen keuangan cerdas berbasis AI untuk membantu individu mengoptimalkan aset finansial masa depan.
            </p>

            <div className="p-3 rounded-2xl bg-white/80 dark:bg-[#042421]/90 backdrop-blur-xl border border-[#10B981]/30 shadow-md flex items-center gap-3">
              <div className="bg-white p-1.5 rounded-xl shrink-0 flex items-center justify-center border border-slate-200/80">
                <img
                  src={vigrisLabsLogo}
                  alt="Vigris Labs Logo"
                  className="h-7 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <div className="space-y-0.5 border-l border-slate-200 dark:border-white/10 pl-2.5">
                <p className="text-[9px] uppercase font-bold text-[#10B981] tracking-wider">Developed By</p>
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug">Vigris Labs</h4>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">Software & AI Innovations</p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[18%] space-y-4">
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Navigasi
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm font-medium">
              {navLinks.map((link, idx) => (
                <li key={idx}>
                  <a
                    href={link.href}
                    className="text-slate-600 dark:text-slate-300 hover:text-[#10B981] dark:hover:text-[#34D399] transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full lg:w-[24%] space-y-4">
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Kontak
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-normal">
              <li className="flex items-start gap-2">
                <span className="text-[#10B981] shrink-0">📍</span>
                <span>Surabaya, Jawa Timur, Indonesia</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#10B981] shrink-0">✉️</span>
                <a href="mailto:contact@vigrislabs.com" className="hover:text-[#10B981] transition-colors break-all">
                  contact@vigrislabs.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#10B981] shrink-0">📞</span>
                <a href="tel:+6281234567890" className="hover:text-[#10B981] transition-colors">
                  +62 812-3456-7890
                </a>
              </li>
            </ul>
          </div>

          <div className="w-full lg:w-[26%] space-y-4">
            <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Berlangganan Update
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              Dapatkan berita rilis fitur terbaru dan tips finansial bulanan dari Vigris Labs.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="Masukkan email kamu..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-full bg-white/80 dark:bg-[#042421]/90 border border-[#10B981]/30 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#10B981] shadow-sm pr-20"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1 bottom-1 px-4 rounded-full bg-[#10B981] hover:bg-[#0F766E] text-white font-bold text-xs transition-all"
                >
                  Kirim
                </button>
              </div>

              {subscribed && (
                <p className="text-[11px] font-bold text-[#10B981] animate-fade-in">
                  ✓ Terima kasih! Email kamu telah terdaftar.
                </p>
              )}
            </form>
          </div>

        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} <strong className="text-slate-800 dark:text-white">Rezekify</strong>. All rights reserved. Powered by <span className="text-[#10B981] font-bold">Vigris Labs</span>.
          </p>

          <div className="flex items-center gap-3">
            {socialLinks.map((social, idx) => (
              <a
                key={idx}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.name}
                className="w-9 h-9 rounded-full bg-white/80 dark:bg-[#042421]/80 border border-[#10B981]/30 text-slate-600 dark:text-slate-300 hover:text-[#10B981] dark:hover:text-[#34D399] hover:border-[#10B981] hover:scale-110 transition-all flex items-center justify-center shadow-sm"
              >
                {social.icon}
              </a>
            ))}
          </div>

        </div>

      </div>
    </footer>
  );
}