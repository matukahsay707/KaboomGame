/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kaboom: {
          dark: '#0d1117',
          mid: '#161b22',
          felt: '#1a3a2a',
          'felt-light': '#234d38',
          accent: '#e94560',
          gold: '#f5c518',
          'gold-dim': '#b8960f',
          green: '#0f3460',
          navy: '#0d1b2a',
          'navy-light': '#1b2838',
        },
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'glow-gold': 'glowGold 2s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(40px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(233, 69, 96, 0.5)' },
          '50%': { boxShadow: '0 0 25px rgba(233, 69, 96, 0.8)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glowGold: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(245, 197, 24, 0.3)' },
          '50%': { boxShadow: '0 0 24px rgba(245, 197, 24, 0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
      screens: {
        'xs': '375px',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
