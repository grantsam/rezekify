import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';

// @ts-ignore
import logoRezekify from '../../assets/icon_text_rezekify.png';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Beranda', href: '#beranda' },
    { name: 'Tentang', href: '#tentang' },
    { name: 'Fitur', href: '#fitur' },
    { name: 'Manfaat', href: '#manfaat' },
    { name: 'Cara Penggunaan', href: '#cara-penggunaan' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8">
      <div
        className={`max-w-7xl mx-auto rounded-full px-6 py-3 flex items-center justify-between transition-all duration-300 ${
          isScrolled
            ? 'bg-white/70 dark:bg-[#052E2B]/80 backdrop-blur-lg shadow-lg border border-white/40 dark:border-[#10B981]/20'
            : 'bg-white/40 dark:bg-[#052E2B]/50 backdrop-blur-md border border-white/20 dark:border-white/10'
        }`}
      >
        <Link to="/" className="flex items-center group">
          <img
            src={logoRezekify}
            alt="Rezekify Logo"
            className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-slate-700 hover:text-[#0F766E] dark:text-slate-200 dark:hover:text-[#10B981] transition-colors"
            >
              {link.name}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="p-2 rounded-full bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#10B981] transition-all"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-[#0F766E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-full text-xs sm:text-sm font-semibold text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 hover:border-[#10B981] transition-all"
          >
            Masuk
          </button>

          <button
            onClick={() => navigate('/register')}
            className="px-5 py-2 rounded-full text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#0F766E] to-[#10B981] hover:shadow-lg hover:shadow-[#10B981]/30 transition-all"
          >
            Daftar
          </button>
        </div>
      </div>
    </header>
  );
}