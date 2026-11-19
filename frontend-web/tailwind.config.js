/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          950: '#050d1a',
          900: '#0a1628',
          800: '#0f2040',
          700: '#152d5a',
        },
        brand: {
          cyan:   '#00d4ff',
          purple: '#8b5cf6',
          emerald:'#10b981',
          amber:  '#f59e0b',
          rose:   '#f43f5e',
        },
      },
      animation: {
        'spin-slow':    'spin 3s linear infinite',
        'pulse-slow':   'pulse 3s ease-in-out infinite',
        'fade-in':      'fadeIn 0.5s ease-out',
        'slide-up':     'slideUp 0.4s ease-out',
        'glow':         'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        glow:    { from: { boxShadow: '0 0 10px rgba(0,212,255,0.3)' }, to: { boxShadow: '0 0 30px rgba(0,212,255,0.7)' } },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
