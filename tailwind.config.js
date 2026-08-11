/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2ff',
          100: '#d9e0ff',
          200: '#b3c2ff',
          300: '#8095ff',
          400: '#4d68ff',
          500: '#1a45ff',
          600: '#0033e6',
          700: '#0028b8',
          800: '#001e8a',
          900: '#00145c',
          950: '#000a2e',
        },
        electric: {
          50: '#eef9ff',
          100: '#d0f0ff',
          200: '#a0e0ff',
          300: '#5ec8ff',
          400: '#1aa8ff',
          500: '#0090f0',
          600: '#0070c0',
          700: '#005590',
          800: '#003a60',
          900: '#001f30',
        },
        gold: {
          50: '#fffbeb',
          100: '#fff3c4',
          200: '#ffe588',
          300: '#ffd24d',
          400: '#ffc024',
          500: '#f5a800',
          600: '#d48800',
          700: '#a86800',
          800: '#7c4d00',
          900: '#503200',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(26,168,255,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(26,168,255,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
