import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/components/(button|modal|chip|progress|tooltip|card|select|popover|listbox).js",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          canvas: '#0c0c0e',
          card: '#141417',
          subtle: '#1a1a1e',
          border: 'rgba(39, 39, 42, 0.8)',
        },
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
    },
  },
  plugins: [heroui()],
};
