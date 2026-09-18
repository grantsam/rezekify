/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
          950: '#1e1b4b',
        },
        runway: {
          healthy: '#10b981',
          warning: '#f59e0b',
          critical: '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-indigo': '0 0 25px -5px rgba(99, 102, 241, 0.15)',
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.15)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.15)',
        'glow-rose': '0 0 25px -5px rgba(244, 63, 94, 0.15)',
      },
    },
  },
  plugins: [],
};
