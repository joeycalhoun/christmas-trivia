/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts}',
  ],
  safelist: [
    // Team colors - ensure these are always included
    'from-red-700', 'to-red-600', 'border-red-400',
    'from-green-700', 'to-green-600', 'border-green-400',
    'from-blue-700', 'to-blue-600', 'border-blue-400',
    'from-yellow-600', 'to-yellow-500', 'border-yellow-400',
    'from-purple-700', 'to-purple-600', 'border-purple-400',
    'from-pink-600', 'to-pink-500', 'border-pink-400',
    'from-cyan-600', 'to-cyan-500', 'border-cyan-400',
    'from-orange-600', 'to-orange-500', 'border-orange-400',
  ],
  theme: {
    extend: {
      fontFamily: {
        christmas: ['Mountains of Christmas', 'cursive'],
        festive: ['Pacifico', 'cursive'],
      },
      colors: {
        christmas: {
          red: '#c41e3a',
          green: '#228b22',
          gold: '#ffd700',
          cream: '#fffdd0',
        },
      },
      animation: {
        'twinkle': 'twinkle 1.5s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'snow': 'snow 10s linear infinite',
        'bounce-slow': 'bounce 3s infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        glow: {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.3)' },
        },
        snow: {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)' },
          '100%': { transform: 'translateY(110vh) rotate(360deg)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 5px #ffd700, 0 0 10px #ffd700' },
          '50%': { boxShadow: '0 0 20px #ffd700, 0 0 30px #ffd700' },
        },
      },
    },
  },
  plugins: [],
}



